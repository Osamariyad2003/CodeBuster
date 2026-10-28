from flask import Blueprint, jsonify, request, session, redirect, current_app
from functools import wraps
from models import db, User
import os
import requests
import secrets
import hmac
import uuid
from dotenv import load_dotenv
from pathlib import Path
from utils.github_client import get_github_session, GITHUB_TIMEOUT

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID', '').strip()
GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET', '').strip()
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5174').strip()

# DEBUG: Verify credentials are loaded (booleans only — never print secret values)
print("=" * 60)
print("[AUTH] GITHUB OAUTH DEBUG INFO")
print("=" * 60)
print(f"[OK] CLIENT_ID loaded: {bool(GITHUB_CLIENT_ID)}")
print(f"[OK] CLIENT_SECRET loaded: {bool(GITHUB_CLIENT_SECRET)}")
print(f"[OK] FRONTEND_URL: {FRONTEND_URL}")
print("=" * 60)

if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
    print("[ERR] CRITICAL: GitHub credentials not configured!")
    print("      Please check your .env file")
print("=" * 60)

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

def login_required(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = session.get('user')
        if not user:
            print(f"[ERR] 401 Unauthorized - No user in session")
            print(f"      Session data: {dict(session)}")
            return jsonify({"error": "Unauthorized"}), 401

        print(f"[OK] Authenticated user: {user.get('login')}")
        return f(*args, **kwargs)

    return decorated_function

@auth_bp.route('/github', methods=['GET'])
def github_auth():
    """Initiate GitHub OAuth flow."""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        return jsonify({"error": "GitHub credentials not configured"}), 500

    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    redirect_uri = f"{FRONTEND_URL}/auth/callback"
    github_auth_url = f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&redirect_uri={redirect_uri}&scope=repo,user&state={state}" 
    print(f"\n[AUTH] OAuth URL generated:")
    print(f"       {github_auth_url}\n")

    return jsonify({"auth_url": github_auth_url})

@auth_bp.route('/callback', methods=['GET'])
def github_callback():
    """Handle GitHub OAuth callback from frontend or direct redirect."""
    code = request.args.get('code')
    error = request.args.get('error')
    state = request.args.get('state')
    expected_state = session.pop('oauth_state', None)

    # Validate CSRF state strictly
    if expected_state:
        if not state or not hmac.compare_digest(state, expected_state):
            print(f"[WARN] CSRF state mismatch or missing: received={state}, expected={expected_state}")
            return jsonify({"error": "Invalid OAuth state parameter (CSRF detected)"}), 400
    print(f"\n{'='*60}")
    print(f"[AUTH] GitHub callback received")
    print(f"{'='*60}")
    print(f"Code received: {bool(code)}")
    print(f"Error: {error}")

    if error:
        error_desc = request.args.get('error_description', error)
        print(f"[ERR] GitHub returned error: {error_desc}")
        return jsonify({"error": error_desc}), 400

    if not code:
        print("[ERR] No authorization code received")
        return jsonify({"error": "No authorization code"}), 400

    try:
        print(f"\n[AUTH] Exchanging code for token...")
        print(f"       Endpoint: https://github.com/login/oauth/access_token")

        session_gh = get_github_session()

        token_response = session_gh.post(
            'https://github.com/login/oauth/access_token',
            data={
                'client_id': GITHUB_CLIENT_ID,
                'client_secret': GITHUB_CLIENT_SECRET,
                'code': code
            },
            headers={'Accept': 'application/json'},
            timeout=GITHUB_TIMEOUT
        )

        print(f"       Response Status: {token_response.status_code}")

        token_data = token_response.json()
        print(f"       Response keys: {sorted(token_data.keys())}")

        if 'error' in token_data:
            error_desc = token_data.get('error_description', token_data.get('error'))
            print(f"\n[ERR] Token exchange failed!")
            print(f"      Error: {error_desc}")
            print(f"\n[INFO] Troubleshooting:")
            print(f"       1. Verify GitHub app Authorization callback URL is: {FRONTEND_URL}/auth/callback")
            print(f"       2. Check CLIENT_ID and CLIENT_SECRET in .env are correct")
            print(f"       3. Ensure code hasn't expired (valid for 10 minutes)")
            return jsonify({
                "error": error_desc,
                "troubleshooting": "Check GitHub app Authorization callback URL setting"
            }), 400

        access_token = token_data.get('access_token')

        if not access_token:
            print("[ERR] No access token in response")
            return jsonify({"error": "No access token received"}), 400

        print(f"[OK] Access token obtained (length: {len(access_token)})")

        print(f"\n[AUTH] Fetching user info from GitHub API...")
        user_response = session_gh.get(
            'https://api.github.com/user',
            headers={
                'Authorization': f'token {access_token}',
                'Accept': 'application/vnd.github.v3+json'
            },
            timeout=GITHUB_TIMEOUT
        )

        print(f"       Response Status: {user_response.status_code}")

        if user_response.status_code != 200:
            print(f"[ERR] User fetch failed: {user_response.text}")
            return jsonify({"error": "Failed to fetch user info"}), 400

        user_data = user_response.json()
        print(f"[OK] User fetched: {user_data.get('login')}")

        # Upsert user in DB
        user_db = User.query.filter_by(github_id=user_data['id']).first()
        if not user_db:
            user_db = User(
                id=str(uuid.uuid4()),
                github_id=user_data['id'],
                username=user_data['login'],
                email=user_data.get('email'),
                avatar_url=user_data.get('avatar_url')
            )
            db.session.add(user_db)
        else:
            user_db.username = user_data['login']
            user_db.email = user_data.get('email')
            user_db.avatar_url = user_data.get('avatar_url')

        user_db.set_access_token(access_token)

        db.session.commit()

        session.permanent = True
        session['user'] = {
            'id': user_db.id,
            'github_id': user_db.github_id,
            'login': user_db.username,
            'avatar_url': user_db.avatar_url
        }

        print(f"[OK] User persisted in DB and session: {user_data['login']}")
        print(f"{'='*60}\n")

        # Support direct browser navigation redirect or JSON response
        if 'text/html' in request.headers.get('Accept', '') and 'application/json' not in request.headers.get('Accept', ''):
            return redirect(f"{FRONTEND_URL}/dashboard?auth_success=1")

        return jsonify({
            "success": True,
            "user": session['user'],
            "message": "Authentication successful"
        })

    except Exception as e:
        print(f"[ERR] OAuth Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "OAuth Error", "details": str(e)}), 500

@auth_bp.route('/demo', methods=['POST', 'GET'])
def demo_auth():
    """Instant 1-click developer/demo session without external GitHub roundtrip."""
    if not current_app.config.get('DEBUG') and not current_app.config.get('TESTING'):
        return jsonify({"error": "Demo authentication is disabled in production"}), 403
    # Find existing main developer user or create a demo user
    user_db = User.query.filter_by(username='Osamariyad2003').first()
    if not user_db:
        user_db = User.query.filter_by(username='codebuster-demo').first()
    if not user_db:
        user_db = User(
            id=str(uuid.uuid4()),
            github_id=99999999,
            username='codebuster-demo',
            email='demo@codebuster.ai',
            avatar_url='https://avatars.githubusercontent.com/u/9919?s=200&v=4'
        )
        db.session.add(user_db)
        user_db.set_access_token('demo_access_token')
        db.session.commit()

    session.permanent = True
    session['user'] = {
        'id': user_db.id,
        'github_id': user_db.github_id,
        'login': user_db.username,
        'avatar_url': user_db.avatar_url
    }
    print(f"[OK] Demo session active: {user_db.username}")

    if request.method == 'GET' and 'text/html' in request.headers.get('Accept', ''):
        return redirect(f"{FRONTEND_URL}/dashboard")

    return jsonify({
        "success": True,
        "authenticated": True,
        "user": session['user'],
        "message": "Demo authentication successful"
    })

@auth_bp.route('/user', methods=['GET'])
def get_current_user():
    """Get current authenticated user."""
    user = session.get('user')
    if user:
        login = user.get('login') or user.get('username')
        user_id = user.get('id')
        user_db = None
        if user_id:
            user_db = User.query.get(user_id)
        if not user_db and login:
            user_db = User.query.filter_by(username=login).first()

        if not user_db:
            print(f"[WARN] Stale session found for {login}; DB user row is missing")
            session.pop('user', None)
            return jsonify({
                "authenticated": False,
                "user": None,
                "reason": "stale_session"
            })

        session['user'] = {
            'id': user_db.id,
            'github_id': user_db.github_id,
            'login': user_db.username,
            'avatar_url': user_db.avatar_url
        }
        print(f"[OK] User found in session and DB: {user_db.username}")
        return jsonify({
            "authenticated": True,
            "user": session['user']
        })
    else:
        print(f"[INFO] No user in session")
        return jsonify({
            "authenticated": False,
            "user": None
        })


@auth_bp.route('/profile', methods=['GET'])
@login_required
def get_user_profile():
    """Retrieve detailed user profile, stats, and preferences."""
    user_session = session.get('user') or {}
    user_id = user_session.get('id')
    login = user_session.get('login') or user_session.get('username')

    user_db = None
    if user_id:
        user_db = User.query.get(user_id)
    if not user_db and login:
        user_db = User.query.filter_by(username=login).first()

    if not user_db:
        return jsonify({"error": "User not found"}), 404

    from models import Review, Issue, Repository
    repo_ids = [r.id for r in user_db.repositories] if user_db.repositories else []
    total_reviews = Review.query.filter(Review.repository_id.in_(repo_ids)).count() if repo_ids else 0
    total_issues = Issue.query.join(Review).filter(Review.repository_id.in_(repo_ids)).count() if repo_ids else 0

    return jsonify({
        "success": True,
        "user": user_db.to_dict(),
        "stats": {
            "total_repositories": len(repo_ids),
            "total_reviews": total_reviews,
            "total_issues_detected": total_issues,
            "active_ai_provider": os.getenv("AI_PROVIDER", "gemini"),
            "ai_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            "security_encryption": "Fernet AES-256 Enabled"
        },
        "repositories": [
            {
                "id": r.id,
                "name": r.name,
                "full_name": r.full_name,
                "language": r.language or "Multiple",
                "status": r.status or "active",
                "reviews_count": len(r.reviews) if r.reviews else 0
            }
            for r in user_db.repositories
        ]
    })


@auth_bp.route('/profile', methods=['PUT', 'POST'])
@login_required
def update_user_profile():
    """Update user personal info and AI reviewer preferences."""
    user_session = session.get('user') or {}
    user_id = user_session.get('id')
    login = user_session.get('login') or user_session.get('username')

    user_db = None
    if user_id:
        user_db = User.query.get(user_id)
    if not user_db and login:
        user_db = User.query.filter_by(username=login).first()

    if not user_db:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}

    # Update basic profile attributes
    if 'email' in data:
        user_db.email = (data['email'] or '').strip()
    if 'bio' in data:
        user_db.bio = (data['bio'] or '').strip()
    if 'role' in data:
        user_db.role = (data['role'] or '').strip()
    if 'company' in data:
        user_db.company = (data['company'] or '').strip()
    if 'avatar_url' in data and data['avatar_url']:
        user_db.avatar_url = data['avatar_url'].strip()

    # Update preferences dictionary
    if 'preferences' in data and isinstance(data['preferences'], dict):
        user_db.set_preferences(data['preferences'])

    db.session.commit()

    # Update session cache
    session['user'] = {
        'id': user_db.id,
        'github_id': user_db.github_id,
        'login': user_db.username,
        'avatar_url': user_db.avatar_url,
        'role': user_db.role
    }

    return jsonify({
        "success": True,
        "message": "Profile updated successfully",
        "user": user_db.to_dict()
    })

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Log out the current user."""
    session.clear()
    return jsonify({"success": True})
