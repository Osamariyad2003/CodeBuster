"""Metrics and monitoring routes for webhook events and jobs."""
from flask import Blueprint, jsonify, request, session
from functools import wraps
from datetime import datetime, timedelta, date as date_cls
from collections import defaultdict
import uuid

from models import db, Review

metrics_bp = Blueprint('metrics', __name__, url_prefix='/api')

def login_required(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

import json
from app.redis_client import get_redis

# Prefix for Redis keys
REDIS_KEY_EVENTS = "codebuster:metrics:webhook_events"
REDIS_KEY_JOBS = "codebuster:metrics:analysis_jobs"

def record_webhook_event(delivery_id, event_type, repo, action, status, reason=None, payload=None):
    """Record a webhook event for monitoring."""
    try:
        r = get_redis()
        event = {
            'delivery_id': delivery_id,
            'event_type': event_type,
            'repo': repo,
            'action': action,
            'status': status,
            'reason': reason,
            'payload': payload,
            'timestamp': datetime.utcnow().isoformat()
        }
        r.lpush(REDIS_KEY_EVENTS, json.dumps(event))
        r.ltrim(REDIS_KEY_EVENTS, 0, 499) # Keep 500
        return event
    except Exception:
        return None

def record_job(job_id, delivery_id, repo, status='pending'):
    """Record an analysis job for monitoring."""
    try:
        r = get_redis()
        job = {
            'job_id': job_id,
            'delivery_id': delivery_id,
            'repo': repo,
            'status': status,
            'retries': 0,
            'started_at': datetime.utcnow().isoformat(),
            'completed_at': None,
            'duration_ms': None,
            'error': None,
            'result': None
        }
        r.lpush(REDIS_KEY_JOBS, json.dumps(job))
        r.ltrim(REDIS_KEY_JOBS, 0, 499)
        return job
    except Exception:
        return None

def update_job(job_id, **kwargs):
    """Update a job's status in Redis."""
    try:
        r = get_redis()
        # Find and update in list (atomic iteration replacement)
        jobs_raw = r.lrange(REDIS_KEY_JOBS, 0, -1)
        for i, item_json in enumerate(jobs_raw):
            job = json.loads(item_json)
            if job['job_id'] == job_id:
                job.update(kwargs)
                if kwargs.get('status') in ['completed', 'failed'] and job.get('started_at'):
                    started = datetime.fromisoformat(job['started_at'])
                    job['completed_at'] = datetime.utcnow().isoformat()
                    job['duration_ms'] = int((datetime.utcnow() - started).total_seconds() * 1000)
                
                r.lset(REDIS_KEY_JOBS, i, json.dumps(job))
                return job
    except Exception:
        pass
    return None

from models import db, Review, Issue
from sqlalchemy import func

@metrics_bp.route('/metrics/summary', methods=['GET'])
@metrics_bp.route('/monitoring/summary', methods=['GET']) # Added alias for frontend
@login_required
def get_metrics_summary():
    """Get summary metrics for the dashboard."""
    webhook_events = []
    analysis_jobs = []
    
    try:
        r = get_redis()
        events_raw = r.lrange(REDIS_KEY_EVENTS, 0, -1)
        jobs_raw = r.lrange(REDIS_KEY_JOBS, 0, -1)
        
        webhook_events = [json.loads(e) for e in events_raw]
        analysis_jobs = [json.loads(j) for j in jobs_raw]
    except Exception as e:
        print(f"Redis error: {e}")
        # Continue with empty events/jobs
        
    try:
        # Dashboard Counts
        total_events = len(webhook_events)
        total_jobs = len(analysis_jobs)
        
        # 1. Health Score (Average of last 10 reviews)
        avg_health = db.session.query(func.avg(Review.overall_health_score)).\
            filter(Review.status == 'completed').\
            order_by(Review.completed_at.desc()).limit(1).scalar()
        
        if avg_health is None:
            avg_health = 100
            
        # 2. Accepted Issues (Status = resolved/accepted)
        accepted_issues = db.session.query(func.count(Issue.id)).\
            filter(Issue.status.in_(['resolved', 'accepted'])).scalar() or 0
            
        # 3. Critical Issues (Severity = critical, status = open)
        critical_issues = db.session.query(func.count(Issue.id)).\
            filter(Issue.severity == 'critical', Issue.status == 'open').scalar() or 0
            
        # 4. Avg Confidence
        avg_conf = db.session.query(func.avg(Issue.confidence)).scalar() or 0
        
        return jsonify({
            'events': total_events,
            'jobs': total_jobs,
            'health': int(avg_health),
            'accepted_issues': accepted_issues,
            'critical_issues': critical_issues,
            'avg_confidence': round(float(avg_conf), 2),
            'event_details': {
                'total': total_events,
                'accepted': len([e for e in webhook_events if e.get('status') == 'accepted']),
                'ignored': len([e for e in webhook_events if e.get('status') == 'ignored']),
                'failed': len([e for e in webhook_events if e.get('status') == 'failed'])
            },
            'job_details': {
                'total': total_jobs,
                'running': len([j for j in analysis_jobs if j.get('status') == 'running']),
                'completed': len([j for j in analysis_jobs if j.get('status') == 'completed']),
                'failed': len([j for j in analysis_jobs if j.get('status') == 'failed'])
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@metrics_bp.route('/metrics/health-trend', methods=['GET'])
@login_required
def get_health_trend():
    """Daily health trend for the last N days (default 7).

    Returns one entry per day in range — days with no reviews get score=null
    so the frontend can render gaps correctly.
    """
    try:
        days = max(1, min(90, int(request.args.get('days', 7))))
    except (TypeError, ValueError):
        days = 7

    today = datetime.utcnow().date()
    start_day = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start_day, datetime.min.time())

    try:
        reviews = db.session.query(
            Review.completed_at,
            Review.overall_health_score,
        ).filter(
            Review.status == 'completed',
            Review.completed_at != None,
            Review.completed_at >= start_dt,
        ).all()

        # Bucket scores by day.
        by_day = defaultdict(list)
        for completed_at, score in reviews:
            if score is None:
                continue
            d = completed_at.date()
            by_day[d].append(score)

        data = []
        for offset in range(days):
            d = start_day + timedelta(days=offset)
            scores = by_day.get(d, [])
            avg = round(sum(scores) / len(scores), 1) if scores else None
            data.append({
                'date': d.isoformat(),        # e.g. "2026-04-24"
                'score': avg,
                'count': len(scores),
            })

        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500



def _safe_redis_events():
    """Return list of events from Redis; empty list if Redis unavailable or data invalid."""
    try:
        r = get_redis()
        events_raw = r.lrange(REDIS_KEY_EVENTS, 0, -1) or []
    except Exception:
        return []
    out = []
    for e in events_raw:
        try:
            out.append(json.loads(e))
        except (TypeError, ValueError):
            continue
    return out


def _safe_redis_jobs():
    """Return list of jobs from Redis; empty list if Redis unavailable or data invalid."""
    try:
        r = get_redis()
        jobs_raw = r.lrange(REDIS_KEY_JOBS, 0, -1) or []
    except Exception:
        return []
    out = []
    for j in jobs_raw:
        try:
            out.append(json.loads(j))
        except (TypeError, ValueError):
            continue
    return out


@metrics_bp.route('/events', methods=['GET'])
@login_required
def get_events():
    """Get webhook events with optional filtering. Returns empty list on any backend error."""
    try:
        repo = request.args.get('repo', '') or ''
        event_type = request.args.get('eventType', '') or ''
        status = request.args.get('status', '') or ''
        delivery_id = request.args.get('deliveryId', '') or ''
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(100, max(1, int(request.args.get('limit') or request.args.get('per_page', 50))))

        webhook_events = _safe_redis_events()
        filtered = list(webhook_events)

        if repo:
            filtered = [e for e in filtered if repo.lower() in (e.get('repo') or '').lower()]
        if event_type:
            filtered = [e for e in filtered if (e.get('event_type') or '') == event_type]
        if status:
            filtered = [e for e in filtered if (e.get('status') or '') == status]
        if delivery_id:
            filtered = [e for e in filtered if delivery_id.lower() in (e.get('delivery_id') or '').lower()]

        start = (page - 1) * per_page
        end = start + per_page
        paginated = filtered[start:end]
        total_pages = (len(filtered) + per_page - 1) // per_page if per_page else 0

        return jsonify({
            'events': paginated,
            'total': len(filtered),
            'page': page,
            'per_page': per_page,
            'totalPages': total_pages
        })
    except Exception:
        return jsonify({
            'events': [],
            'total': 0,
            'page': 1,
            'per_page': 15,
            'totalPages': 0
        }), 200


@metrics_bp.route('/events/<delivery_id>', methods=['GET'])
@login_required
def get_event_detail(delivery_id):
    """Get details for a specific webhook event."""
    webhook_events = _safe_redis_events()
    for event in webhook_events:
        if event.get('delivery_id') == delivery_id:
            return jsonify(event)
    return jsonify({'error': 'Event not found'}), 404


@metrics_bp.route('/jobs', methods=['GET'])
@login_required
def get_jobs():
    """Get analysis jobs with optional filtering. Returns empty list on any backend error."""
    try:
        repo = request.args.get('repo', '') or ''
        status = request.args.get('status', '') or ''
        delivery_id = request.args.get('deliveryId', '') or ''
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(100, max(1, int(request.args.get('limit') or request.args.get('per_page', 50))))

        analysis_jobs = _safe_redis_jobs()
        filtered = list(analysis_jobs)

        if repo:
            filtered = [j for j in filtered if repo.lower() in (j.get('repo') or '').lower()]
        if status:
            filtered = [j for j in filtered if (j.get('status') or '') == status]
        if delivery_id:
            filtered = [j for j in filtered if delivery_id.lower() in (j.get('delivery_id') or '').lower()]

        start = (page - 1) * per_page
        end = start + per_page
        paginated = filtered[start:end]
        total_pages = (len(filtered) + per_page - 1) // per_page if per_page else 0

        return jsonify({
            'jobs': paginated,
            'total': len(filtered),
            'page': page,
            'per_page': per_page,
            'totalPages': total_pages
        })
    except Exception:
        return jsonify({
            'jobs': [],
            'total': 0,
            'page': 1,
            'per_page': 15,
            'totalPages': 0
        }), 200


@metrics_bp.route('/jobs/<job_id>', methods=['GET'])
@login_required
def get_job_detail(job_id):
    """Get details for a specific analysis job."""
    analysis_jobs = _safe_redis_jobs()
    for job in analysis_jobs:
        if job.get('job_id') == job_id:
            return jsonify(job)
    return jsonify({'error': 'Job not found or no longer in cache'}), 404

