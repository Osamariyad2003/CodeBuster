from flask import Blueprint, jsonify, request, session
from functools import wraps
import requests
import os
from dotenv import load_dotenv
from pathlib import Path
import jwt
from datetime import datetime, timedelta
from models import db, User, Repository, Review, Issue
import uuid
import hmac
import hashlib
from utils.github_comment import format_github_comment
from services.fix_service import FixService
from utils.github_auth import get_installation_access_token, generate_app_jwt
from utils.github_client import (
    list_installation_repositories,
    search_public_repositories as github_search_public_repositories,
)
from utils.limiter import limiter
from flask_limiter.util import get_remote_address
from app.redis_client import get_redis
from app.rate_limit import rate_limit
from app.idempotency import is_duplicate_delivery
from app.tasks import process_github_event
from models.schemas import (
    GithubOwnerSchema,
    GithubRepoItemSchema,
    InstalledReposResponseSchema,
    PublicReposResponseSchema,
)
import json

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

GITHUB_APP_ID = os.getenv('GITHUB_APP_ID')
GITHUB_WEBHOOK_SECRET = os.getenv('GITHUB_WEBHOOK_SECRET')
GITHUB_APP_PRIVATE_KEY_PATH = os.getenv('GITHUB_APP_PRIVATE_KEY_PATH')

github_bp = Blueprint('github', __name__, url_prefix='/github')


def _user_rate_limit_key():
    """Rate limit key based on logged-in user, falling back to IP."""
    user_session = session.get('user') or {}
    login = user_session.get('login') or user_session.get('username')
    if login:
        return f"user:{login}"
    return get_remote_address()


def _sanitize_github_repo(raw_repo, installation_id=None):
    """
    Project a raw GitHub repository object into our safe schema dict.
    Never include secrets or tokens.
    """
    owner = raw_repo.get("owner") or {}
    owner_schema = GithubOwnerSchema(
        login=owner.get("login", ""),
        avatar_url=owner.get("avatar_url"),
    )

    # updated_at may be None or missing
    updated = raw_repo.get("updated_at")

    item = GithubRepoItemSchema(
        id=raw_repo.get("id"),
        full_name=raw_repo.get("full_name"),
        html_url=raw_repo.get("html_url"),
        description=raw_repo.get("description"),
        stargazers_count=raw_repo.get("stargazers_count") or 0,
        language=raw_repo.get("language"),
        updated_at=updated,
        owner=owner_schema,
        installation_id=installation_id,
    )
    return item


def _cache_get_installed_repos(redis_client, installation_id: int):
    if not redis_client:
        return None
    key = f"github:installed_repos:{installation_id}"
    try:
        raw = redis_client.get(key)
        if not raw:
            return None
        data = json.loads(raw)
        return data
    except Exception as e:
        print(f"[WARN]️ Failed to read installed repos cache for {installation_id}: {e}")
        return None


def _cache_set_installed_repos(redis_client, installation_id: int, repos, ttl_seconds: int = 60):
    if not redis_client:
        return
    key = f"github:installed_repos:{installation_id}"
    try:
        redis_client.setex(key, ttl_seconds, json.dumps(repos))
    except Exception as e:
        print(f"[WARN]️ Failed to write installed repos cache for {installation_id}: {e}")

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

    return decorated_function

# Auth functions moved to utils/github_auth.py

@github_bp.route('/repos', methods=['GET'])
@login_required
def get_repos():
    """Get user's GitHub repositories using GitHub App."""
    try:
        # Generate App JWT
        print("DEBUG: Generating App JWT...")
        app_jwt = generate_app_jwt()
        if not app_jwt:
            print("DEBUG: App JWT generation failed")
            return jsonify({"error": "GitHub App not configured"}), 500
        print("DEBUG: App JWT generated successfully")
        
        # Get app installations
        print("DEBUG: Fetching app installations...")
        from utils.github_client import get_github_session, GITHUB_TIMEOUT
        session_gh = get_github_session()
        
        installations_response = session_gh.get(
            'https://api.github.com/app/installations',
            headers={
                'Authorization': f'Bearer {app_jwt}',
                'Accept': 'application/vnd.github.v3+json'
            },
            timeout=GITHUB_TIMEOUT
        )
        
        if installations_response.status_code != 200:
            print(f"DEBUG: Failed to get installations: {installations_response.status_code} {installations_response.text}")
            return jsonify({"error": "Failed to get app installations"}), 500
        
        installations = installations_response.json()
        print(f"DEBUG: Found {len(installations)} installations")
        all_repos = []
        
        # For each installation, get repos
        for installation in installations:
            inst_id = installation['id']
            access_token = get_installation_access_token(inst_id)
            if not access_token: continue
            
            repos_response = session_gh.get(
                'https://api.github.com/installation/repositories?per_page=100',
                headers={
                    'Authorization': f'token {access_token}',
                    'Accept': 'application/vnd.github.v3+json'
                },
                timeout=GITHUB_TIMEOUT
            )
            
            if repos_response.status_code == 200:
                repos_data = repos_response.json().get('repositories', [])
                for r in repos_data:
                    r['installation_id'] = inst_id # Track installation ID
                all_repos.extend(repos_data)
        
        # Get already connected repos from DB
        user_session = session.get('user')
        if not user_session:
            return jsonify({"error": "Unauthorized"}), 401
            
        user_db = User.query.filter_by(username=user_session.get('login')).first()
        connected_full_names = []
        if user_db:
            connected_full_names = [r.full_name for r in user_db.repositories]

        # Fetch personal public repos via user OAuth token
        oauth_token = user_session.get('access_token')
        if oauth_token:
            print("DEBUG: Fetching user personal repos via OAuth...")
            user_repos_response = session_gh.get(
                'https://api.github.com/user/repos?type=owner&per_page=100',
                headers={
                    'Authorization': f'token {oauth_token}',
                    'Accept': 'application/vnd.github.v3+json'
                },
                timeout=GITHUB_TIMEOUT
            )
            if user_repos_response.status_code == 200:
                user_repos = user_repos_response.json()
                print(f"DEBUG: Found {len(user_repos)} personal repos")
                # Merge personal repos into all_repos, avoiding duplicates
                existing_ids = {r.get('id') for r in all_repos}
                for r in user_repos:
                    if r.get('id') not in existing_ids:
                        all_repos.append(r)
            else:
                print(f"DEBUG: OAuth repo fetch failed: {user_repos_response.status_code}")

        # Format repos data
        repos_list = [
            {
                'id': repo.get('id'),
                'name': repo.get('name'),
                'full_name': repo.get('full_name'),
                'description': repo.get('description'),
                'url': repo.get('html_url'),
                'language': repo.get('language'),
                'is_connected': repo.get('full_name') in connected_full_names,
                'installation_id': repo.get('installation_id'),
                'owner': repo.get('owner', {}).get('login'),
                'private': repo.get('private', False)
            }
            for repo in all_repos
        ]
        
        return jsonify({
            "success": True,
            "repos": repos_list,
            "count": len(repos_list)
        })
    except requests.exceptions.Timeout:
        print("[ERR] GitHub API request timed out")
        return jsonify({"error": "Request timed out"}), 500
    except Exception as e:
        print(f"[ERR] Error fetching repos: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@github_bp.route('/public-repos', methods=['GET'])
@limiter.limit("30 per minute")
def search_public_repositories():
    """
    Search public GitHub repositories by keyword.

    - Auth optional
    - IP-based rate limiting (30/minute)
    - Validates query length
    - Only returns safe projection of GitHub repository data
    """
    try:
        query = (request.args.get('query') or '').strip()
        if len(query) < 2 or len(query) > 100:
            return jsonify({
                "error": "Query must be between 2 and 100 characters"
            }), 422

        page = request.args.get('page', default=1, type=int) or 1
        per_page = request.args.get('per_page', default=20, type=int) or 20
        page = max(1, page)
        per_page = max(1, min(50, per_page))

        # Very simple caching: key is query+page+per_page, 30s TTL.
        try:
            redis_client = get_redis()
        except Exception as e:
            print(f"[WARN]️ Redis unavailable for public-repos cache: {e}")
            redis_client = None

        cache_key = f"github:public_search:{query}:{page}:{per_page}"
        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    data = json.loads(cached)
                    # Already in response shape from previous call
                    return jsonify(data)
            except Exception as e:
                print(f"[WARN]️ Failed to read public search cache: {e}")

        # Call GitHub Search API
        try:
            resp = github_search_public_repositories(query, page=page, per_page=per_page)
        except requests.exceptions.Timeout:
            return jsonify({"error": "GitHub search timed out. Please try again."}), 503
        except Exception as e:
            print(f"[ERR] Error calling GitHub search API: {e}")
            return jsonify({"error": "Failed to search public repositories"}), 502

        if resp.status_code == 401 or resp.status_code == 403:
            return jsonify({
                "error": "GitHub authorization failed. Please try again later."
            }), 502
        if resp.status_code == 422:
            return jsonify({
                "error": "GitHub rejected this query. Try a simpler search term."
            }), 422
        if resp.status_code == 503:
            return jsonify({
                "error": "GitHub is temporarily unavailable. Please try again shortly."
            }), 503
        if resp.status_code != 200:
            print(f"[ERR] Unexpected GitHub search status {resp.status_code}: {resp.text[:200]}")
            return jsonify({"error": "Failed to search public repositories"}), 502

        payload = resp.json() or {}
        total_count = int(payload.get("total_count", 0))
        items_raw = payload.get("items") or []

        # Sanitize items into our schema
        items = []
        for raw in items_raw:
            try:
                item = _sanitize_github_repo(raw, installation_id=None)
                # Public search never flags connection state; frontend can derive if needed.
                item.is_connected = None
                item.connected_repo_id = None
                items.append(item)
            except Exception as e:
                print(f"[WARN]️ Failed to sanitize public repo {raw.get('full_name')}: {e}")

        resp_schema = PublicReposResponseSchema(
            items=items,
            page=page,
            per_page=per_page,
            total_count=total_count,
        )
        data = resp_schema.model_dump(mode="json")

        if redis_client:
            try:
                redis_client.setex(cache_key, 30, json.dumps(data))
            except Exception as e:
                print(f"[WARN]️ Failed to write public search cache: {e}")

        return jsonify(data)
    except Exception as e:
        print(f"[ERR] Error in /github/public-repos: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to search public repositories"}), 500


@github_bp.route('/installed-repos', methods=['GET'])
@login_required
@limiter.limit("60 per minute", key_func=_user_rate_limit_key)
def search_installed_repos():
    """
    Search repositories accessible via the user's GitHub App installations.

    - Auth required (session)
    - Uses installation access tokens (GitHub App) only
    - Results are cached per installation_id for 60 seconds
    """
    try:
        query = (request.args.get('query') or '').strip()
        page = request.args.get('page', default=1, type=int) or 1
        per_page = request.args.get('per_page', default=20, type=int) or 20

        page = max(1, page)
        per_page = max(1, min(50, per_page))

        user_session = session.get('user')
        if not user_session:
            return jsonify({"error": "Unauthorized"}), 401

        login = user_session.get('login') or user_session.get('username')
        user_db = User.query.filter_by(username=login).first() if login else None
        if not user_db:
            resp = InstalledReposResponseSchema(
                items=[],
                page=page,
                per_page=per_page,
                total_estimate=0,
            )
            return jsonify(resp.model_dump(mode="json"))

        # Determine installations associated with this user via connected repositories.
        installation_ids = sorted({
            r.installation_id for r in user_db.repositories if r.installation_id
        })

        if not installation_ids:
            app_jwt = generate_app_jwt()
            if app_jwt:
                from utils.github_client import get_github_session, GITHUB_TIMEOUT
                session_gh = get_github_session()
                installations_response = session_gh.get(
                    'https://api.github.com/app/installations',
                    headers={
                        'Authorization': f'Bearer {app_jwt}',
                        'Accept': 'application/vnd.github.v3+json',
                    },
                    timeout=GITHUB_TIMEOUT,
                )
                if installations_response.status_code == 200:
                    installation_ids = sorted(
                        inst.get('id')
                        for inst in installations_response.json()
                        if inst.get('id')
                    )

        if not installation_ids:
            resp = InstalledReposResponseSchema(
                items=[],
                page=page,
                per_page=per_page,
                total_estimate=0,
            )
            return jsonify(resp.model_dump(mode="json"))

        try:
            redis_client = get_redis()
        except Exception as e:
            print(f"[WARN]️ Redis unavailable for installed-repos cache: {e}")
            redis_client = None

        # Build map of connected repos for CTA purposes.
        connected_repos = Repository.query.filter(
            Repository.connected_by == user_db.id
        ).all()
        connected_by_full_name = {
            r.full_name: r.id for r in connected_repos
        }

        all_items = []

        for inst_id in installation_ids:
            cached = _cache_get_installed_repos(redis_client, inst_id)
            if cached is not None:
                raw_repos = cached
            else:
                access_token = get_installation_access_token(inst_id)
                if not access_token:
                    print(f"[WARN]️ Failed to get installation token for {inst_id}")
                    continue
                raw_repos = list_installation_repositories(inst_id, access_token)
                # Cache raw GitHub payload (safe fields only; no tokens).
                _cache_set_installed_repos(redis_client, inst_id, raw_repos, ttl_seconds=60)

            for raw in raw_repos:
                try:
                    item = _sanitize_github_repo(raw, installation_id=inst_id)
                    all_items.append(item)
                except Exception as e:
                    print(f"[WARN]️ Failed to sanitize repo {raw.get('full_name')}: {e}")

        # De-duplicate by full_name (installation may appear multiple times in edge cases)
        dedup_map = {}
        for item in all_items:
            dedup_map[item.full_name] = item

        items = list(dedup_map.values())

        # Filter server-side by query
        if query:
            q = query.lower()
            items = [
                it for it in items
                if q in it.full_name.lower()
                or (it.description or "").lower().find(q) != -1
            ]

        total_estimate = len(items)


        for it in items:
            repo_id = connected_by_full_name.get(it.full_name)
            it.is_connected = bool(repo_id)
            it.connected_repo_id = repo_id

    
        start = (page - 1) * per_page
        end = start + per_page
        page_items = items[start:end]

        resp = InstalledReposResponseSchema(
            items=page_items,
            page=page,
            per_page=per_page,
            total_estimate=total_estimate,
        )
        return jsonify(resp.model_dump(mode="json"))
    except requests.exceptions.Timeout:
        return jsonify({"error": "GitHub request timed out. Please try again."}), 503
    except Exception as e:
        print(f"[ERR] Error in /github/installed-repos: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to search installed repositories"}), 500

@github_bp.route('/connect', methods=['POST'])
@login_required
def connect_repo():
    """Connect a GitHub repository to CodeBuster."""
    try:
        data = request.get_json()
        repo_full_name = data.get('repo_full_name')
        repo_id = data.get('repo_id')
        inst_id = data.get('installation_id')
        
        if not repo_full_name:
            return jsonify({"error": "repo_full_name is required"}), 400
        
        user_session = session.get('user')
        user_db = User.query.filter_by(username=user_session.get('login')).first()
        
        if not user_db:
            session.pop('user', None)
            return jsonify({
                "error": "Your login session is stale. Please sign in with GitHub again.",
                "code": "STALE_SESSION"
            }), 401

        # Check if already exists
        existing = Repository.query.filter_by(full_name=repo_full_name).first()
        if existing:
            return jsonify({
                "success": True,
                "message": "Already connected",
                "repo_id": existing.id
            })

        new_repo = Repository(
            id=str(uuid.uuid4()),
            owner=repo_full_name.split('/')[0],
            name=repo_full_name.split('/')[1],
            full_name=repo_full_name,
            github_repo_id=repo_id,
            installation_id=inst_id,
            connected_by=user_db.id,
            status='active'
        )
        
        db.session.add(new_repo)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Repository {repo_full_name} connected",
            "repo_id": new_repo.id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500



@github_bp.route('/fork', methods=['POST'])
@login_required
def fork_repo():
    """
    Fork a public GitHub repository to the authenticated user's account.

    Body (JSON):
      - source_full_name: "owner/repo"  (required)
      - default_branch_only: bool       (optional, default true)

    Uses the user's OAuth access_token (we request the `repo` scope at login,
    which includes `public_repo` — enough to fork public repos).

    On success the new fork lives under the user's account. If the CodeBuster
    GitHub App is installed on that account with "All repositories", the fork
    becomes reviewable from the Installed tab on the next refresh.
    """
    try:
        data = request.get_json() or {}
        source_full_name = (data.get('source_full_name') or '').strip()
        default_branch_only = bool(data.get('default_branch_only', True))

        if not source_full_name or '/' not in source_full_name:
            return jsonify({"error": "source_full_name must be 'owner/repo'"}), 400

        user_session = session.get('user') or {}

        # Sessions store {id, login, avatar_url} only — the GitHub OAuth token
        # lives encrypted on the User row (set in routes/auth.py callback).
        # Try the session first for backwards compatibility, then fall back
        # to the DB.
        oauth_token = user_session.get('access_token')
        if not oauth_token:
            user_db = None
            if user_session.get('id'):
                user_db = User.query.get(user_session['id'])
            if not user_db and user_session.get('login'):
                user_db = User.query.filter_by(username=user_session['login']).first()
            if user_db:
                try:
                    oauth_token = user_db.get_access_token()
                except Exception:
                    oauth_token = None

        if not oauth_token:
            return jsonify({"error": "No GitHub OAuth token available — log out and log in again to refresh it"}), 401

        owner, name = source_full_name.split('/', 1)
        api_url = f'https://api.github.com/repos/{owner}/{name}/forks'

        resp = requests.post(
            api_url,
            headers={
                'Authorization': f'token {oauth_token}',
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            json={'default_branch_only': default_branch_only},
            timeout=30,
        )

        # GitHub returns 202 Accepted (fork creation is async) with the fork's
        # metadata in the body. Some happy-path mocks return 200/201.
        if resp.status_code not in (200, 201, 202):
            try:
                err_body = resp.json()
            except Exception:
                err_body = {'raw': resp.text[:500]}
            return jsonify({
                "error": f"GitHub fork failed (HTTP {resp.status_code})",
                "github_response": err_body,
            }), 400 if resp.status_code in (403, 422) else 502

        fork = resp.json() or {}
        return jsonify({
            "success": True,
            "fork_full_name": fork.get('full_name'),
            "fork_id": fork.get('id'),
            "html_url": fork.get('html_url'),
            "default_branch": fork.get('default_branch'),
            "pending": resp.status_code == 202,
            "message": (
                f"Fork queued — {fork.get('full_name')} will appear on GitHub "
                "shortly. Once your CodeBuster install picks it up, it shows in "
                "the Installed tab."
            ) if resp.status_code == 202 else f"Forked to {fork.get('full_name')}",
        })

    except requests.Timeout:
        return jsonify({"error": "GitHub timed out — try again in a moment"}), 504
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {e}"}), 500


@github_bp.route('/disconnect', methods=['POST'])
@login_required
def disconnect_repo():
    try:
        data = request.get_json()
        repo_full_name = data.get('repo_full_name')

        repo = Repository.query.filter_by(full_name=repo_full_name).first()
        if repo:
            db.session.delete(repo)
            db.session.commit()

        return jsonify({"success": True, "message": f"Disconnected {repo_full_name}"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500



@github_bp.route('/fix/apply', methods=['POST'])
@login_required
def apply_fix():
    """Apply a suggested fix to a GitHub repository."""
    try:
        data = request.get_json()
        issue_id = data.get('issue_id')
        review_id = data.get('review_id')
        
        if not issue_id:
            return jsonify({"error": "issue_id is required"}), 400
            
        # 1. Get issue and review
        issue = Issue.query.get(issue_id)
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
            
        review = Review.query.get(issue.review_id)
        if not review:
            return jsonify({"error": "Review not found"}), 404
            
        repository = Repository.query.get(review.repository_id)
        if not repository or not repository.installation_id:
            return jsonify({"error": "Repository not connected or missing installation_id"}), 400
            
        # 3. Get installation token
        access_token = get_installation_access_token(repository.installation_id)
        if not access_token:
            return jsonify({"error": "Failed to get installation token"}), 500

        # 4. Apply fix using FixService
        fix_service = FixService(access_token)
        result = fix_service.apply_fix(
            repository.full_name,
            issue.file_path,
            issue
        )

        # If the call failed with a permissions error, the cached installation
        # token may predate a recent App permissions upgrade. Mint a fresh one
        # (bypassing the Redis cache) and retry exactly once.
        if not result.get('success'):
            err_text = (result.get('error') or '').lower()
            looks_like_perm = ('403' in err_text) or ('not accessible by integration' in err_text)
            if looks_like_perm:
                print("[?] Stale installation token suspected — refreshing and retrying fix")
                fresh_token = get_installation_access_token(
                    repository.installation_id, force_refresh=True
                )
                if fresh_token and fresh_token != access_token:
                    result = FixService(fresh_token).apply_fix(
                        repository.full_name,
                        issue.file_path,
                        issue,
                    )

        if result.get('success'):
            # Update issue status
            issue.status = 'resolved'
            db.session.commit()
            return jsonify({
                "success": True,
                "message": "Fix applied successfully",
                "branch": result.get('branch'),
                "commit_sha": result.get('commit_sha'),
                "url": result.get('html_url'),
                "commit_url": result.get('commit_url'),
                "pr_url": result.get('pr_url'),
                "pr_number": result.get('pr_number'),
                "pr_warning": result.get('pr_warning'),
            })
        else:
            return jsonify({
                "success": False,
                "error": result.get('error')
            }), 400
            
    except Exception as e:
        print(f"[ERR] Error applying fix: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@github_bp.route('/fix/ai-apply', methods=['POST'])
@login_required
def apply_ai_fix():
    """
    Generate a fix with GPT-5.6 (the whole corrected file, not the analyzer's
    canned snippet) and open a real PR from it.
    """
    try:
        data = request.get_json()
        issue_id = data.get('issue_id')

        if not issue_id:
            return jsonify({"error": "issue_id is required"}), 400

        issue = Issue.query.get(issue_id)
        if not issue:
            return jsonify({"error": "Issue not found"}), 404

        review = Review.query.get(issue.review_id)
        if not review:
            return jsonify({"error": "Review not found"}), 404

        repository = Repository.query.get(review.repository_id)
        if not repository or not repository.installation_id:
            return jsonify({"error": "Repository not connected or missing installation_id"}), 400

        access_token = get_installation_access_token(repository.installation_id)
        if not access_token:
            return jsonify({"error": "Failed to get installation token"}), 500

        from services.ai_review_service import AIReviewService
        ai_service = AIReviewService()

        fix_service = FixService(access_token)
        result = fix_service.apply_ai_fix_pr(
            repository.full_name,
            issue.file_path,
            issue,
            ai_service,
        )

        if not result.get('success'):
            err_text = (result.get('error') or '').lower()
            looks_like_perm = ('403' in err_text) or ('not accessible by integration' in err_text)
            if looks_like_perm:
                fresh_token = get_installation_access_token(
                    repository.installation_id, force_refresh=True
                )
                if fresh_token and fresh_token != access_token:
                    result = FixService(fresh_token).apply_ai_fix_pr(
                        repository.full_name,
                        issue.file_path,
                        issue,
                        ai_service,
                    )

        if result.get('success'):
            issue.status = 'resolved'
            db.session.commit()
            return jsonify({
                "success": True,
                "message": "AI fix PR opened successfully",
                "branch": result.get('branch'),
                "commit_sha": result.get('commit_sha'),
                "url": result.get('html_url'),
                "commit_url": result.get('commit_url'),
                "pr_url": result.get('pr_url'),
                "pr_number": result.get('pr_number'),
                "pr_warning": result.get('pr_warning'),
                "ai_summary": result.get('ai_summary'),
            })
        else:
            return jsonify({
                "success": False,
                "error": result.get('error')
            }), 400

    except Exception as e:
        print(f"[ERR] Error applying AI fix: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@github_bp.route('/fix/sprint', methods=['POST'])
@login_required
def apply_fix_sprint():
    """
    Fix Sprint: batch-fix multiple issues in one branch/PR.

    Body: { "issue_ids": ["...", ...] }  (all issues must belong to the same
    repository — mixing repos in one sprint isn't supported since a sprint
    is one branch + one PR against one repo).
    """
    try:
        data = request.get_json() or {}
        issue_ids = data.get('issue_ids')
        if not issue_ids or not isinstance(issue_ids, list):
            return jsonify({"error": "issue_ids (non-empty array) is required"}), 400

        issues = Issue.query.filter(Issue.id.in_(issue_ids)).all()
        if not issues:
            return jsonify({"error": "No matching issues found"}), 404

        review_ids = {i.review_id for i in issues}
        reviews = {r.id: r for r in Review.query.filter(Review.id.in_(review_ids)).all()}
        repo_ids = {reviews[rid].repository_id for rid in review_ids if rid in reviews}
        if len(repo_ids) != 1:
            return jsonify({"error": "All issues in a Fix Sprint must belong to the same repository"}), 400

        repository = Repository.query.get(next(iter(repo_ids)))
        if not repository or not repository.installation_id:
            return jsonify({"error": "Repository not connected or missing installation_id"}), 400

        access_token = get_installation_access_token(repository.installation_id)
        if not access_token:
            return jsonify({"error": "Failed to get installation token"}), 500

        fix_service = FixService(access_token)
        result = fix_service.apply_fix_sprint(repository.full_name, issues)

        if not result.get('success'):
            err_text = (result.get('error') or '').lower()
            looks_like_perm = ('403' in err_text) or ('not accessible by integration' in err_text)
            if looks_like_perm:
                fresh_token = get_installation_access_token(repository.installation_id, force_refresh=True)
                if fresh_token and fresh_token != access_token:
                    result = FixService(fresh_token).apply_fix_sprint(repository.full_name, issues)

        if result.get('success'):
            fixed_ids = {a['issue_id'] for a in result.get('applied', [])}
            if fixed_ids:
                Issue.query.filter(Issue.id.in_(fixed_ids)).update({Issue.status: 'resolved'}, synchronize_session=False)
                db.session.commit()
            return jsonify({
                "success": True,
                "message": f"Fix Sprint complete: {len(result.get('applied', []))} issue(s) fixed.",
                "branch": result.get('branch'),
                "applied": result.get('applied'),
                "skipped": result.get('skipped'),
                "commits": result.get('commits'),
                "pr_url": result.get('pr_url'),
                "pr_number": result.get('pr_number'),
                "pr_warning": result.get('pr_warning'),
            })
        return jsonify({
            "success": False,
            "error": result.get('error'),
            "skipped": result.get('skipped'),
        }), 400

    except Exception as e:
        db.session.rollback()
        print(f"[ERR] Error running fix sprint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@github_bp.route('/fix/preview', methods=['POST'])
@login_required
def preview_fix():
    """Compute a fix preview (description + diff) without committing anything."""
    try:
        data = request.get_json() or {}
        issue_id = data.get('issue_id')
        if not issue_id:
            return jsonify({"error": "issue_id is required"}), 400

        issue = Issue.query.get(issue_id)
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        review = Review.query.get(issue.review_id)
        if not review:
            return jsonify({"error": "Review not found"}), 404
        repository = Repository.query.get(review.repository_id)
        if not repository or not repository.installation_id:
            return jsonify({"error": "Repository not connected"}), 400

        access_token = get_installation_access_token(repository.installation_id)
        if not access_token:
            return jsonify({"error": "Failed to get installation token"}), 500

        result = FixService(access_token).preview_fix(
            repository.full_name, issue.file_path, issue
        )
        status = 200 if result.get('success') else 400
        return jsonify(result), status
    except Exception as e:
        print(f"[ERR] Error previewing fix: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@github_bp.route('/ai/health', methods=['GET'])
@login_required
def ai_health():
    """
    Live status of the configured AI provider(s) — which one is active, its
    model, and the outcome of the most recent dispatch (success, rate
    limit, auth failure, etc). Polled by the frontend to show a status
    indicator instead of letting the user find out only when a preview/
    enhance call fails.
    """
    from services.ai_review_service import get_ai_health
    return jsonify(get_ai_health())


@github_bp.route('/issues/<issue_id>/enhance', methods=['POST'])
@login_required
def enhance_issue_on_demand(issue_id):
    """
    Run AI enhancement on a single issue, on demand. Used when a finding
    didn't make the top-25 cutoff during the review's batch enhancement and
    the user wants a real code fix from the LLM (e.g. after the fix
    preview returned `comment_only_fix: true`).

    Flow:
      1. Load the issue + its repo
      2. Fetch the file content from GitHub via the App's installation token
      3. Call AIReviewService.enhance_issue_with_retry on this single issue
      4. Persist the new ai_explanation / suggested_fix back to the row
      5. Return the updated issue dict so the frontend can refresh its state
    """
    try:
        issue = Issue.query.get(issue_id)
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        review = Review.query.get(issue.review_id)
        if not review:
            return jsonify({"error": "Review not found"}), 404
        repository = Repository.query.get(review.repository_id)
        if not repository or not repository.installation_id:
            return jsonify({"error": "Repository not connected"}), 400

        # Pull the file via the GitHub App so we get the current content the
        # AI should reason about (rather than whatever was scanned earlier —
        # the user may have already partially fixed things).
        access_token = get_installation_access_token(repository.installation_id)
        if not access_token:
            return jsonify({"error": "Failed to get installation token"}), 500

        gh_resp = requests.get(
            f"https://api.github.com/repos/{repository.full_name}/contents/{issue.file_path}",
            headers={
                'Authorization': f'token {access_token}',
                'Accept': 'application/vnd.github.v3+json',
            },
            timeout=30,
        )
        if gh_resp.status_code != 200:
            return jsonify({
                "error": f"Could not fetch {issue.file_path} from GitHub (HTTP {gh_resp.status_code})",
            }), 400
        try:
            import base64
            file_content = base64.b64decode(gh_resp.json().get('content', '')).decode('utf-8', errors='replace')
        except Exception as e:
            return jsonify({"error": f"Could not decode file content: {e}"}), 500

        # Detect language from path so the LLM picks the right syntax.
        ext = (issue.file_path or '').lower()
        if ext.endswith(('.js', '.jsx', '.mjs', '.cjs')):
            language = 'javascript'
        elif ext.endswith(('.ts', '.tsx')):
            language = 'typescript'
        elif ext.endswith('.go'):
            language = 'go'
        elif ext.endswith('.java'):
            language = 'java'
        elif ext.endswith('.rb'):
            language = 'ruby'
        elif ext.endswith('.rs'):
            language = 'rust'
        elif ext.endswith('.cs'):
            language = 'csharp'
        elif ext.endswith(('.c', '.cc', '.cpp', '.h', '.hpp')):
            language = 'cpp'
        else:
            language = 'python'  # safe default

        # Build the issue dict the AI service expects.
        from services.ai_review_service import AIReviewService
        svc = AIReviewService()
        if not svc.provider:
            return jsonify({
                "error": "No AI provider configured. Set OPENROUTER_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY in backend/.env.",
            }), 400

        issue_payload = {
            'id': issue.id,
            'title': issue.title,
            'category': issue.category,
            'severity': issue.severity,
            'confidence': issue.confidence,
            'file': issue.file_path,
            'file_path': issue.file_path,
            'line': issue.line_number,
            'line_number': issue.line_number,
            'description': issue.description or '',
            'tool': issue.tool,
            'module': issue.module,
            'evidence': issue.get_evidence(),
            'references': issue.get_references(),
        }
        existing_fix = issue.get_suggested_fix() or {}
        if existing_fix:
            issue_payload['suggested_fix'] = existing_fix

        enhanced = svc.enhance_issue_with_retry(issue_payload, file_content, language)
        if not enhanced or not enhanced.get('ai_explanation'):
            from services.ai_review_service import get_ai_health
            health = get_ai_health()
            reason = health.get('last_error_type')
            reason_text = {
                "rate_limited": f"{svc.provider} is rate-limited right now. Wait a bit and try again, or switch AI_PROVIDER in backend/.env.",
                "auth_error": f"{svc.provider}'s API key looks invalid or expired. Check the key in backend/.env.",
                "provider_down": f"{svc.provider} is returning server errors right now.",
                "network_error": f"Couldn't reach {svc.provider} — check network connectivity.",
            }.get(reason, "AI enhancement did not produce an explanation. Try again, or check the worker logs.")
            return jsonify({
                "error": reason_text,
                "ai_provider": svc.provider,
                "ai_error_type": reason,
                "ai_error_detail": health.get('last_error_message'),
            }), 502

        # Persist the new fields back to the row so subsequent preview / apply
        # calls see the real LLM output.
        if enhanced.get('ai_explanation'):
            issue.ai_explanation = enhanced['ai_explanation']
        # Dimension-analyzer-sourced issues (e.g. performance N+1 findings)
        # are persisted without a line_number/code_snippet — the AI service
        # verifies and returns both, so backfill them here. Without this,
        # FixService.preview_fix has no snippet to match and no line to
        # anchor on, and fails with "Could not locate code to fix
        # automatically" even though the LLM produced a valid fix.
        if not issue.line_number and enhanced.get('line'):
            try:
                issue.line_number = int(enhanced['line'])
            except (TypeError, ValueError):
                pass
        if not issue.code_snippet and enhanced.get('code_snippet'):
            issue.code_snippet = enhanced['code_snippet']
        # The AI service normalises suggested_fix to {content: "..."} but the
        # FixService still reads `.code`, so write both forms for compatibility.
        new_fix = enhanced.get('suggested_fix') or {}
        if isinstance(new_fix, dict):
            code = new_fix.get('code') or new_fix.get('content')
            if code:
                merged_fix = dict(existing_fix or {})
                merged_fix['code'] = code
                merged_fix['content'] = code
                if new_fix.get('explanation'):
                    merged_fix['explanation'] = new_fix['explanation']
                issue.set_suggested_fix(merged_fix)

        # Pack any new tags / impact / recommendation onto extra_metadata so
        # the drawer shows the AI-Senior-Engineer treatment for this row too.
        meta = issue.get_extra_metadata() if hasattr(issue, 'get_extra_metadata') else {}
        try:
            if not isinstance(meta, dict):
                meta = {}
        except Exception:
            meta = {}
        if enhanced.get('recommendation'):
            meta['recommendation'] = enhanced['recommendation']
        if enhanced.get('impact'):
            meta['impact'] = enhanced['impact']
        if enhanced.get('tags'):
            meta['tags'] = list(enhanced['tags'])[:10]
        if meta:
            issue.extra_metadata = json.dumps(meta)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "AI enhancement applied. Try Preview Fix again.",
            "issue": issue.to_dict(),
        })
    except Exception as e:
        db.session.rollback()
        print(f"[ERR] Error enhancing issue {issue_id}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@github_bp.route('/connected-repos', methods=['GET'])
@login_required
def get_connected_repos():
    try:
        user_session = session.get('user')
        user_db = User.query.filter_by(username=user_session.get('login')).first()
        
        if not user_db:
            return jsonify({"repos": [], "count": 0})
            
        repos = [r.to_dict() for r in user_db.repositories]
        return jsonify({
            "success": True,
            "repos": repos,
            "count": len(repos)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
        
    except Exception as e:
        print(f"[ERR] Error fetching connected repos: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    except Exception as e:
        print(f"[ERR] Webhook error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    finally:
        # cleanup if needed
        pass

@github_bp.route('/webhook', methods=['POST'])
def github_webhook_handler():
    """Wrapped webhook handler with Rate Limiting and Idempotency."""
    try:
        r = get_redis()
    except Exception as e:
        print(f"Redis connection failed: {e}")
        return jsonify({"error": "Internal Error"}), 500

    client_ip = request.remote_addr
    if not rate_limit(r, client_ip, limit_per_minute=60):
        print(f"[WARN]️ Rate limit exceeded for {client_ip}")
        return jsonify({"error": "Too many requests"}), 429

    delivery_id = request.headers.get('X-GitHub-Delivery')
    if delivery_id:
        if is_duplicate_delivery(r, delivery_id):
            print(f"[INFO]️ Duplicate delivery skipped: {delivery_id}")
            return jsonify({"message": "Already processed"}), 200

    return github_webhook_logic()

def github_webhook_logic():
    """Actual webhook logic."""
    import hmac
    import hashlib
    
    try:
        # Verify webhook signature
        signature = request.headers.get('X-Hub-Signature-256', '')
        body = request.get_data()
        
        expected_signature = 'sha256=' + hmac.new(
            GITHUB_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            print("[ERR] Invalid webhook signature")
            return jsonify({"error": "Invalid signature"}), 401
        
        payload = request.get_json()
        event_type = request.headers.get('X-GitHub-Event')
        delivery_id = request.headers.get('X-GitHub-Delivery', str(uuid.uuid4()))
        installation_id = payload.get('installation', {}).get('id', '')
        repo_name = payload.get('repository', {}).get('full_name', '')
        
        # Import metrics recording
        from routes.metrics import record_webhook_event, record_job
        
        print(f"\\n{'='*60}")
        print(f"[?] GitHub Webhook Received")
        print(f"{'='*60}")
        print(f"Event Type: {event_type}")
        print(f"Repository: {repo_name}")
        
        if event_type == 'pull_request':
            action = payload.get('action')
            if action in ['opened', 'synchronize', 'reopened']:
                print(f"[IN] Enqueueing analysis for PR: {repo_name}")
                
                # Enqueue Celery task
                celery_payload = {
                    'delivery_id': delivery_id,
                    'event_type': event_type,
                    'repo': repo_name,
                    'action': action,
                    'payload': payload,
                    'installation_id': str(installation_id)
                }
                task = process_github_event.delay(celery_payload)
                
                record_webhook_event(delivery_id, event_type, repo_name, action, 'accepted', payload=None)
                record_job(task.id, delivery_id, repo_name, 'pending')
                
                return jsonify({
                    "status": "accepted", 
                    "message": "Analysis enqueued", 
                    "job_id": task.id
                }), 202
                
            record_webhook_event(delivery_id, event_type, repo_name, action, 'ignored', reason=f'Action {action} not processed')
            return jsonify({"status": "ignored", "action": action}), 200
            
        elif event_type == 'push':
            print(f"[IN] Enqueueing analysis for Push: {repo_name}")
            
            # Enqueue Celery task
            celery_payload = {
                'delivery_id': delivery_id,
                'event_type': event_type,
                'repo': repo_name,
                'payload': payload,
                'installation_id': str(installation_id)
            }
            task = process_github_event.delay(celery_payload)
            
            record_webhook_event(delivery_id, event_type, repo_name, 'push', 'accepted', payload=None)
            record_job(task.id, delivery_id, repo_name, 'pending')
            
            return jsonify({
                "status": "accepted", 
                "message": "Analysis enqueued", 
                "job_id": task.id
            }), 202
        else:
            record_webhook_event(delivery_id, event_type, repo_name, None, 'ignored', reason=f'Event type {event_type} not processed')
            print(f"[WARN]️  Unhandled event type: {event_type}")
            return jsonify({"message": "Event received but not processed"}), 200
        
    except Exception as e:
        print(f"[ERR] Webhook error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def handle_pull_request(payload):
    """Handle pull request events."""
    try:
        from services.review_orchestrator import ReviewOrchestrator
        from datetime import datetime
        import base64
        
        action = payload.get('action')
        pr = payload.get('pull_request', {})
        repo = payload.get('repository', {})
        installation_id = payload.get('installation', {}).get('id')
        
        if not installation_id:
            print("[ERR] No installation ID in webhook payload")
            return jsonify({"error": "No installation ID"}), 400

        if action in ['opened', 'synchronize']:
            repo_full_name = repo.get('full_name')
            pr_number = pr.get('number')
            commit_sha = pr.get('head', {}).get('sha')
            
            # Get installation access token
            access_token = get_installation_access_token(installation_id)
            if not access_token:
                return jsonify({"error": "Failed to get installation token"}), 500
            
            # Find or create repository in DB
            repository = Repository.query.filter_by(full_name=repo_full_name).first()
            if not repository:
                repository = Repository(
                    id=str(uuid.uuid4()),
                    owner=repo.get('owner', {}).get('login', ''),
                    name=repo.get('name', ''),
                    full_name=repo_full_name,
                    github_repo_id=repo.get('id'),
                    installation_id=installation_id,
                    status='active'
                )
                db.session.add(repository)
                db.session.commit()
            
            # Run analysis
            from utils.github_client import fetch_pr_files
            files_to_analyze = fetch_pr_files(repo_full_name, pr_number, access_token)
            
            if not files_to_analyze:
                return jsonify({"message": "No files to analyze"}), 200
            
            # Run analysis
            orchestrator = ReviewOrchestrator()
            result = orchestrator.analyze(files_to_analyze)
            
            # Create review record
            review = Review(
                id=str(uuid.uuid4()),
                repository_id=repository.id,
                pr_number=pr_number,
                commit_sha=commit_sha,
                branch=pr.get('head', {}).get('ref'),
                trigger_type='webhook',
                status='completed',
                overall_health_score=result['overall_health_score'],
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )
            review.set_category_scores(result['category_scores'])
            review.set_findings_count(result['summary'])
            db.session.add(review)
            
            # Save issues and post comments
            for issue_data in result['prioritized_issues']:
                issue = Issue(
                    id=issue_data.get('id', str(uuid.uuid4())),
                    review_id=review.id,
                    module=issue_data.get('category', 'unknown'),
                    severity=issue_data.get('severity', 'minor'),
                    category=issue_data.get('category'),
                    title=issue_data.get('title', 'Unknown'),
                    description=issue_data.get('description'),
                    file_path=issue_data.get('file', 'unknown'),
                    line_number=issue_data.get('line'),
                    code_snippet=issue_data.get('code_snippet'),
                    tool=issue_data.get('tool', 'unknown'),
                    confidence=issue_data.get('confidence', 0.5),
                    priority_score=issue_data.get('priority_score', 50)
                )
                db.session.add(issue)
                
                # Post inline comment for major/critical issues
                if issue_data.get('severity') in ['critical', 'major']:
                    comment_body = format_github_comment(issue_data)
                    comment_url = f"https://api.github.com/repos/{repo_full_name}/pulls/{pr_number}/comments"
                    requests.post(comment_url, headers=headers, json={
                        'body': comment_body,
                        'commit_id': commit_sha,
                        'path': issue_data.get('file'),
                        'line': issue_data.get('line'),
                        'side': 'RIGHT'
                    })
            
            db.session.commit()
            return jsonify({"success": True, "review_id": review.id})
        
        return jsonify({"message": f"Action {action} skipped"})
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
        
        return jsonify({"message": f"Action '{action}' acknowledged"})
        
    except Exception as e:
        print(f"[ERR] Error handling PR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def handle_push(payload):
    """Handle push events."""
    try:
        repo = payload.get('repository', {})
        ref = payload.get('ref')
        commits = payload.get('commits', [])
        
        print(f"Branch: {ref}")
        print(f"Commits: {len(commits)}")
        
        # TODO: Process commits if needed
        
    except Exception as e:
        print(f"[ERR] Error handling push: {str(e)}")
        return jsonify({"error": str(e)}), 500

@github_bp.route('/install-url', methods=['GET'])
@github_bp.route('/api/github/install-url', methods=['GET'])  # Add /api prefix for frontend
@login_required
def get_install_url():
    """Return the GitHub App installation URL.

    Uses the GitHub App slug from env (GITHUB_APP_SLUG). If that is not set,
    defaults to the current app slug 'osamariyad2003'. The final URL is logged
    for easier debugging.
    """
    # NOTE: we hardcode the fallback to the known GitHub App slug
    # for this environment so OS-level env vars cannot force an old slug.
    app_slug = os.getenv('GITHUB_APP_SLUG') or 'osamariyad2003'
    install_url = f"https://github.com/apps/osamariyad2003/installations/new"
    print(f"[LINK] GitHub App install URL resolved to: {install_url}")
    return jsonify({
        "success": True,
        "url": install_url
    })

@github_bp.route('/installations/sync', methods=['POST'])
@login_required
def sync_installation():
    """Sync an installation and its repositories."""
    try:
        data = request.get_json()
        installation_id = data.get('installation_id')
        
        if not installation_id:
            return jsonify({"error": "installation_id is required"}), 400
        
        user_session = session.get('user')
        user_db = User.query.filter_by(username=user_session.get('login')).first()
        
        if not user_db:
            return jsonify({"error": "User not found"}), 404
        
        # Get installation access token
        access_token = get_installation_access_token(installation_id)
        if not access_token:
            return jsonify({"error": "Failed to get installation token"}), 500
        
        # Fetch repositories for this installation
        from utils.github_client import get_github_session, GITHUB_TIMEOUT
        session_gh = get_github_session()
        
        repos_response = session_gh.get(
            'https://api.github.com/installation/repositories?per_page=100',
            headers={
                'Authorization': f'token {access_token}',
                'Accept': 'application/vnd.github.v3+json'
            },
            timeout=GITHUB_TIMEOUT
        )
        
        if repos_response.status_code != 200:
            return jsonify({"error": "Failed to fetch repositories"}), 500
            
        repos_data = repos_response.json().get('repositories', [])
        connected_repos = []

        for r_data in repos_data:
            repo_full_name = r_data.get('full_name')
            # Find or create repository
            repo = Repository.query.filter_by(full_name=repo_full_name).first()
            if not repo:
                repo = Repository(
                    id=str(uuid.uuid4()),
                    owner=repo_full_name.split('/')[0],
                    name=repo_full_name.split('/')[1],
                    full_name=repo_full_name,
                    github_repo_id=r_data.get('id'),
                    installation_id=installation_id,
                    connected_by=user_db.id,
                    status='active',
                    description=r_data.get('description'),
                    language=r_data.get('language'),
                    is_private=r_data.get('private', False),
                    default_branch=r_data.get('default_branch', 'main')
                )
                db.session.add(repo)
            else:
                # Update installation ID if changed
                repo.installation_id = installation_id
                repo.status = 'active'
            
            connected_repos.append(repo.to_dict())

        db.session.commit()
        return jsonify({
            "success": True,
            "connected_repos": connected_repos
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
