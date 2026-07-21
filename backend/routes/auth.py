from flask import Blueprint, jsonify, request, session, redirect
from functools import wraps
from models import db, User
import os
import requests
from dotenv import load_dotenv
from pathlib import Path
from utils.github_client import get_github_session, GITHUB_TIMEOUT

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID', '').strip()
GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET', '').strip()
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5174').strip()

# DEBUG: Verify credentials are loaded
print("=" * 60)
print("[AUTH] GITHUB OAUTH DEBUG INFO")
print("=" * 60)
print(f"[OK] CLIENT_ID loaded: {bool(GITHUB_CLIENT_ID)}")
print(f"[OK] CLIENT_SECRET loaded: {bool(GITHUB_CLIENT_SECRET)}")
print(f"[OK] FRONTEND_URL: {FRONTEND_URL}")
print(f"[OK] CLIENT_ID: {GITHUB_CLIENT_ID}")
print(f"[OK] CLIENT_SECRET length: {len(GITHUB_CLIENT_SECRET)} chars")
print(f"[OK] CLIENT_SECRET (first 5): {GITHUB_CLIENT_SECRET[:5]}...")
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

    redirect_uri = f"{FRONTEND_URL}/auth/callback"

    github_auth_url = f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&redirect_uri={redirect_uri}&scope=repo,user"

    print(f"\n[AUTH] OAuth URL generated:")
    print(f"       {github_auth_url}\n")

    return jsonify({"auth_url": github_auth_url})

@auth_bp.route('/callback', methods=['GET'])
def github_callback():
    """Handle GitHub OAuth callback from frontend."""
    code = request.args.get('code')
    error = request.args.get('error')

    print(f"\n{'='*60}")
    print(f"[AUTH] GitHub callback received")
    print(f"{'='*60}")
    print(f"Code: {code[:20]}..." if code else "Code: None")
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
        print(f"       CLIENT_ID: {GITHUB_CLIENT_ID}")
        print(f"       CLIENT_SECRET length: {len(GITHUB_CLIENT_SECRET)}")
        print(f"       Code: {code[:15]}...")

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
        print(f"       Response: {token_data}")

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
                id=str(__import__('uuid').uuid4()),
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

        return jsonify({
            "success": True,
            "user": session['user'],
            "message": "Authentication successful"
        })

    except Exception as e:
        print(f"[ERR] OAuth Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return redirect(f"{FRONTEND_URL}/?error={str(e)}")


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

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Log out the current user."""
    session.pop('user', None)
    return jsonify({"success": True})
