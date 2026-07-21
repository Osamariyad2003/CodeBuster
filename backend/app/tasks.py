import logging
import json
import time
from typing import Any, Dict
from .celery_app import celery_app

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@celery_app.task(
    name="process_github_event",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True
)
def process_github_event(self, payload):
    """
    Background task to run the full analysis pipeline.
    Handles Repo lookup, Static Analysis, AI Enrichment, DB Storage, and GitHub Check Runs.
    """
    import sys
    import os
    # Ensure backend root is in path for imports
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
        
    from main import app as flask_app
    from models import db, Review, Issue, Repository
    from services.review_orchestrator import ReviewOrchestrator
    from utils.github_auth import get_installation_access_token
    from utils.github_client import fetch_pr_files, fetch_all_repo_files
    from utils.github_comment import format_github_comment
    from routes.metrics import update_job
    import os
    import requests
    import uuid
    from datetime import datetime

    from celery.exceptions import SoftTimeLimitExceeded

    delivery_id = payload.get('delivery_id', 'unknown')
    event_type = payload.get('event_type', 'unknown')
    repo_name = payload.get('repo', 'unknown')
    installation_id = payload.get('installation_id')
    raw_payload = payload.get('payload', {})
    
    logger.info(f"🚀 Started analysis: {event_type} | Delivery: {delivery_id} | Repo: {repo_name}")
    
    # Update metrics/job status to running if tracking is enabled
    try:
        update_job(self.request.id, status='running')
    except Exception as e:
        logger.warning(f"Could not update job metrics: {e}")

    with flask_app.app_context():
        review = None
        check_run_id = None
        commit_sha = None
        headers = {}
        
        try:
            # 1. Look up repository
            repository = Repository.query.filter_by(full_name=repo_name).first()
            if not repository:
                logger.error(f"Repository not found in DB: {repo_name}")
                return {"status": "error", "message": "Repo not found"}

            # 2. Get GitHub access token
            access_token = get_installation_access_token(installation_id)
            if not access_token:
                logger.error(f"Failed to get installation token for {installation_id}")
                return {"status": "error", "message": "Auth failed"}

            headers = {
                'Authorization': f'token {access_token}',
                'Accept': 'application/vnd.github.v3+json'
            }

            # 3. Handle GitHub Check Run
            pr_data = raw_payload.get('pull_request', {})
            commit_sha = pr_data.get('head', {}).get('sha') or raw_payload.get('after')
            
            if commit_sha:
                check_run_url = f"https://api.github.com/repos/{repo_name}/check-runs"
                check_payload = {
                    "name": "CodeBuster AI Review",
                    "head_sha": commit_sha,
                    "status": "in_progress",
                    "started_at": datetime.utcnow().isoformat() + "Z"
                }
                res = requests.post(check_run_url, headers=headers, json=check_payload, timeout=10)
                check_run_id = res.json().get('id')

            # 4. Create Review record
            review = Review(
                id=str(uuid.uuid4()),
                repository_id=repository.id,
                pr_number=pr_data.get('number'),
                commit_sha=commit_sha,
                branch=pr_data.get('head', {}).get('ref'),
                trigger_type=event_type,
                status='running',
                started_at=datetime.utcnow()
            )
            db.session.add(review)
            db.session.commit()

            # 5. Fetch files and Run analysis
            files = []
            if event_type == 'pull_request':
                # Adding 30s timeout for fetching files
                files = fetch_pr_files(repo_name, pr_data['number'], access_token)
            elif event_type == 'full_scan':
                # Whole-code review: fetch all repo files so orchestrator reads the full codebase
                branch = repository.default_branch or 'main'
                logger.info(f"📁 Fetching all files for {repo_name} (branch: {branch})...")
                files = fetch_all_repo_files(repo_name, branch, access_token)
                logger.info(f"✅ Fetched {len(files)} files for full-code review")
            
            orchestrator = ReviewOrchestrator()
            result = orchestrator.analyze(files, repository_context={
                "repo_id": repository.id,
                "full_name": repo_name,
                "installation_id": installation_id,
                "full_code_review": event_type == "full_scan",
            })

            # 6. Save results to DB
            review.status = 'completed'
            review.completed_at = datetime.utcnow()
            review.overall_health_score = result.get('overall_health_score', 0)
            review.set_category_scores(result.get('category_scores', {}))
            review.set_findings_count(result.get('summary', {}))
            review.top_risks = json.dumps(result.get('top_risks', []))
            review.quick_wins = json.dumps(result.get('quick_wins', []))
            # Pack executive_summary + ai_stats alongside analysis_metadata so
            # the frontend can read everything from one JSON blob via
            # review.extra_metadata.
            extra_meta = dict(result.get('analysis_metadata', {}) or {})
            if result.get('executive_summary'):
                extra_meta['executive_summary'] = result['executive_summary']
            if result.get('ai_stats'):
                extra_meta['ai_stats'] = result['ai_stats']
            review.extra_metadata = json.dumps(extra_meta)
            
            issues_created = []
            for issue_data in result.get('prioritized_issues', []):
                # AI-agent findings carry tags/recommendation/effort that
                # don't have dedicated columns — preserve them on extra_metadata.
                extra_issue_meta: Dict[str, Any] = {}
                tags = issue_data.get('tags')
                if tags:
                    extra_issue_meta['tags'] = list(tags)[:10]
                effort = issue_data.get('effort')
                if effort:
                    extra_issue_meta['effort'] = effort
                recommendation = issue_data.get('recommendation')
                if recommendation:
                    extra_issue_meta['recommendation'] = recommendation

                ai_explanation = issue_data.get('ai_explanation')
                if not ai_explanation:
                    impact = (issue_data.get('description') or '').strip()
                    if impact and recommendation:
                        ai_explanation = f"**Impact:** {impact}\n\n**Recommendation:** {recommendation}"
                    elif impact:
                        ai_explanation = impact

                issue = Issue(
                    id=str(uuid.uuid4()),
                    review_id=review.id,
                    title=issue_data.get('title', 'Unknown'),
                    description=issue_data.get('description'),
                    severity=issue_data.get('severity', 'minor'),
                    category=issue_data.get('category'),
                    file_path=issue_data.get('file', 'unknown'),
                    line_number=issue_data.get('line'),
                    code_snippet=issue_data.get('code_snippet'),
                    priority_score=issue_data.get('priority_score', 0),
                    confidence=issue_data.get('confidence', 0.5),
                    tool=issue_data.get('tool'),
                    module=issue_data.get('module', 'unknown'),
                    ai_explanation=ai_explanation,
                    status='open'
                )
                if extra_issue_meta:
                    issue.extra_metadata = json.dumps(extra_issue_meta)
                issue.set_suggested_fix(issue_data.get('suggested_fix'))
                issue.set_evidence(issue_data.get('evidence_refs') or issue_data.get('evidence', []))
                db.session.add(issue)
                issues_created.append(issue)
                
            db.session.commit()

            # 7. Post Feedback to GitHub (Inline Comments)
            if event_type == 'pull_request':
                comments_url = f"https://api.github.com/repos/{repo_name}/pulls/{pr_data['number']}/comments"
                for issue in issues_created[:5]:
                    if issue.severity in ['critical', 'major']:
                        comment_body = format_github_comment(issue.to_dict())
                        requests.post(comments_url, headers=headers, json={
                            "body": comment_body,
                            "commit_id": commit_sha,
                            "path": issue.file_path,
                            "line": issue.line_number or 1,
                            "side": "RIGHT"
                        }, timeout=10)

            # 8. Complete GitHub Check Run
            if check_run_id:
                conclusion = 'success'
                if any(i.severity == 'critical' for i in issues_created):
                    conclusion = 'failure'
                
                requests.patch(f"https://api.github.com/repos/{repo_name}/check-runs/{check_run_id}", 
                    headers=headers, json={
                        "status": "completed",
                        "conclusion": conclusion,
                        "completed_at": datetime.utcnow().isoformat() + "Z",
                        "output": {
                            "title": f"CodeBuster: {result['summary']['total_issues']} Issues Found",
                            "summary": f"Health Score: {review.overall_health_score}/100"
                        }
                    }, timeout=10
                )

            # Update job metrics on success
            try:
                update_job(self.request.id, status='completed')
            except:
                pass

            logger.info(f"✅ Successfully analyzed {repo_name} (Review: {review.id})")
            return {"status": "success", "review_id": review.id}

        except (Exception, SoftTimeLimitExceeded) as exc:
            db.session.rollback()
            error_msg = str(exc) or "Task timeout exceeded"
            logger.error(f"❌ Analysis failed for {repo_name}: {error_msg}")
            
            # Update job metrics on failure
            try:
                update_job(self.request.id, status='failed', error=error_msg)
            except:
                pass

            # Update DB to failed state if review record exists
            if review:
                try:
                    review.status = 'failed'
                    review.error_message = error_msg
                    review.completed_at = datetime.utcnow()
                    db.session.commit()
                except Exception as inner_exc:
                    logger.error(f"Failed to save failure state: {inner_exc}")

            # Update GitHub Check Run to failed/cancelled
            if check_run_id and headers:
                try:
                    requests.patch(f"https://api.github.com/repos/{repo_name}/check-runs/{check_run_id}", 
                        headers=headers, json={
                            "status": "completed",
                            "conclusion": "cancelled",
                            "output": {
                                "title": "CodeBuster Analysis Failed",
                                "summary": f"Error: {error_msg}"
                            }
                        }, timeout=10)
                except:
                    pass

            # Raise retry for network errors/timeouts, but eventually it will stay 'failed' in DB
            retry_delay = 2 ** self.request.retries * 60
            raise self.retry(exc=exc, countdown=retry_delay)


def run_review_impl(repo_id: str, commit_sha: str, trigger_source: str = "manual"):
    """
    Run full review in-process (no Celery). Used by Celery task and by inline scan when Redis is unavailable.
    Fetches the whole repo via fetch_all_repo_files and runs ReviewOrchestrator.analyze() so the review
    reads the full codebase. Returns dict: {"status": "success"|"idempotent"|"error", "review_id": ..., "message": ...}
    """
    from models import db, Review, Issue, Repository
    from services.review_orchestrator import ReviewOrchestrator
    from services.review_merge import merge_to_canonical_review
    from utils.github_auth import get_installation_access_token
    from utils.github_client import fetch_all_repo_files, fetch_repo_commits
    from datetime import datetime
    import uuid

    logger.info(f"run_review_impl: repo_id={repo_id}, commit_sha={commit_sha}, trigger={trigger_source}")
    review = None
    try:
        repository = Repository.query.get(repo_id)
        if not repository:
            logger.error(f"Repository not found: {repo_id}")
            return {"status": "error", "message": "Repository not found"}

        if not commit_sha or commit_sha == "null":
            try:
                access_token = get_installation_access_token(repository.installation_id)
                if access_token:
                    commits = fetch_repo_commits(
                        repository.full_name, access_token, per_page=1, page=1
                    )
                    if commits:
                        commit_sha = commits[0].get("sha")
            except Exception as e:
                logger.warning(f"Could not resolve latest commit: {e}")
            if not commit_sha:
                commit_sha = "unknown"

        existing = (
            Review.query.filter_by(
                repository_id=repo_id,
                commit_sha=commit_sha,
                status="completed",
            )
            .first()
        )
        if existing:
            logger.info(f"Idempotent skip: existing review_id={existing.id}")
            return {"status": "idempotent", "review_id": existing.id, "message": "Review already exists for this commit"}

        review = Review(
            id=str(uuid.uuid4()),
            repository_id=repo_id,
            commit_sha=commit_sha,
            branch=repository.default_branch or "main",
            trigger_type=trigger_source,
            status="running",
            started_at=datetime.utcnow(),
        )
        db.session.add(review)
        db.session.commit()

        access_token = get_installation_access_token(repository.installation_id)
        if not access_token:
            raise RuntimeError("Failed to get installation token")
        branch = repository.default_branch or "main"
        # Fetch whole repo so the orchestrator reads the full codebase (all code files with content).
        files = fetch_all_repo_files(repository.full_name, branch, access_token)
        logger.info(f"Fetched {len(files)} files for full-code review via orchestrator")

        orchestrator = ReviewOrchestrator()
        result = orchestrator.analyze(
            files,
            repository_context={
                "repo_id": repository.id,
                "full_name": repository.full_name,
                "installation_id": repository.installation_id,
                "full_code_review": True,  # Review reads the whole code (full repo), not a subset.
            },
        )

        merge_to_canonical_review(
            repo_id=repo_id,
            repo_full_name=repository.full_name,
            commit_sha=commit_sha,
            trigger_source=trigger_source,
            orchestrator_result=result,
        )

        review.status = "completed"
        review.completed_at = datetime.utcnow()
        review.overall_health_score = result.get("overall_health_score", 0)
        review.set_category_scores(result.get("category_scores", {}))
        review.set_findings_count(result.get("summary", {}))
        review.top_risks = json.dumps(result.get("top_risks", []))
        review.quick_wins = json.dumps(result.get("quick_wins", []))
        # Pack executive_summary + ai_stats alongside analysis_metadata so
        # the frontend can read everything from one JSON blob via
        # review.extra_metadata.
        extra_meta = dict(result.get("analysis_metadata", {}) or {})
        if result.get("executive_summary"):
            extra_meta["executive_summary"] = result["executive_summary"]
        if result.get("ai_stats"):
            extra_meta["ai_stats"] = result["ai_stats"]
        review.extra_metadata = json.dumps(extra_meta)

        for issue_data in result.get("prioritized_issues", []):
            # AI-agent findings (module='ai') carry tags / recommendation /
            # effort that the deterministic flow doesn't have. Pack the
            # extras into extra_metadata so the UI can render them.
            extra_issue_meta: Dict[str, Any] = {}
            tags = issue_data.get("tags")
            if tags:
                extra_issue_meta["tags"] = list(tags)[:10]
            effort = issue_data.get("effort")
            if effort:
                extra_issue_meta["effort"] = effort
            recommendation = issue_data.get("recommendation")
            if recommendation:
                extra_issue_meta["recommendation"] = recommendation

            # Build a sensible ai_explanation if the upstream didn't provide
            # one — for AI-agent findings this combines the LLM's impact and
            # recommendation into a single human-readable narrative.
            ai_explanation = issue_data.get("ai_explanation")
            if not ai_explanation:
                impact = (issue_data.get("description") or "").strip()
                if impact and recommendation:
                    ai_explanation = f"**Impact:** {impact}\n\n**Recommendation:** {recommendation}"
                elif impact:
                    ai_explanation = impact

            issue = Issue(
                id=str(uuid.uuid4()),
                review_id=review.id,
                title=issue_data.get("title", "Unknown"),
                description=issue_data.get("description"),
                severity=issue_data.get("severity", "minor"),
                category=issue_data.get("category"),
                file_path=issue_data.get("file", issue_data.get("file_path", "unknown")),
                line_number=issue_data.get("line"),
                code_snippet=issue_data.get("code_snippet") or issue_data.get("snippet", {}).get("code"),
                priority_score=issue_data.get("priority_score", 0),
                confidence=issue_data.get("confidence", 0.5),
                tool=issue_data.get("tool"),
                module=issue_data.get("module", "unknown"),
                ai_explanation=ai_explanation,
                status="open",
            )
            issue.set_suggested_fix(issue_data.get("suggested_fix", {}))
            issue.set_evidence(issue_data.get("evidence_refs") or issue_data.get("evidence", []))
            if extra_issue_meta:
                issue.extra_metadata = json.dumps(extra_issue_meta)
            db.session.add(issue)

        db.session.commit()
        logger.info(f"run_review_impl completed: review_id={review.id}")
        return {"status": "success", "review_id": review.id}
    except Exception as exc:
        db.session.rollback()
        logger.exception(f"run_review_impl failed: {exc}")
        if review:
            review.status = "failed"
            review.error_message = str(exc)
            review.completed_at = datetime.utcnow()
            db.session.commit()
        return {"status": "error", "message": str(exc)}


@celery_app.task(
    name="run_review",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def run_review(self, repo_id: str, commit_sha: str, trigger_source: str = "manual"):
    """
    Celery task: run full review for a repository. Delegates to run_review_impl.
    """
    import sys
    import os
    # Ensure backend root is in path for imports
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
        
    from main import app as flask_app
    from routes.metrics import update_job

    logger.info(f"run_review task started: repo_id={repo_id}, commit_sha={commit_sha}, trigger={trigger_source}")
    try:
        update_job(self.request.id, status="running")
    except Exception:
        pass
    with flask_app.app_context():
        out = run_review_impl(repo_id, commit_sha, trigger_source)
        if out.get("status") == "error":
            try:
                update_job(self.request.id, status="failed", error=out.get("message", "Review failed"))
            except Exception as e:
                logger.warning("Could not update job metrics on error: %s", e)
            raise RuntimeError(out.get("message", "run_review_impl failed"))
        if out.get("status") in ("success", "idempotent") and "review_id" in out:
            try:
                # Preserve the orchestrator status (success | idempotent) on the
                # job result so the frontend can show different copy for
                # "fresh review ready" vs "existing review (already scanned)".
                update_job(
                    self.request.id,
                    status="completed",
                    result={
                        "review_id": str(out["review_id"]),
                        "scan_status": out.get("status"),
                        "message": out.get("message"),
                    },
                )
            except Exception as e:
                logger.warning("Could not update job metrics on success: %s", e)
        return out

