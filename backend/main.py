import sys
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timedelta
import os
from sqlalchemy import text
from utils.config_loader import settings

from utils.logging_config import init_app_logging
from utils.error_handlers import init_error_handlers
from utils.limiter import init_limiter
import structlog

app = Flask(__name__)
init_app_logging(app)
init_error_handlers(app)
init_limiter(app)
logger = structlog.get_logger()
app.secret_key = settings.FLASK_SECRET_KEY

# Session configuration
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

# CORS configuration
CORS(app, supports_credentials=True, origins=[
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:3000"
])

# Initialize database so it's available both when running directly and when
# imported by Celery workers (which need flask_app.app_context()).
from models import init_db
init_db(app)


# Register blueprints
from routes.auth import auth_bp
from routes.github import github_bp, get_install_url, search_installed_repos, search_public_repositories
from routes.review import review_bp
from routes.issue import issue_bp
from routes.feedback import feedback_bp
from routes.metrics import metrics_bp
from routes.repos import repos_bp
from routes.analyze import analyze_bp
from routes.enriched_review import enriched_bp
from routes.gerrit import gerrit_bp
from routes.analytics import analytics_bp

app.register_blueprint(auth_bp)
app.register_blueprint(github_bp)
# Frontend expects install URL at /api/github/install-url; OPTIONS must return 2xx for CORS preflight
def api_github_install_url():
    if request.method == 'OPTIONS':
        return '', 204
    return get_install_url()
app.add_url_rule('/api/github/install-url', view_func=api_github_install_url, methods=['GET', 'OPTIONS'])


# Mirror GitHub search endpoints under /api/github/* for the SPA.
def api_github_installed_repos():
    if request.method == 'OPTIONS':
        return '', 204
    return search_installed_repos()


def api_github_public_repos():
    if request.method == 'OPTIONS':
        return '', 204
    return search_public_repositories()


app.add_url_rule(
    '/api/github/installed-repos',
    view_func=api_github_installed_repos,
    methods=['GET', 'OPTIONS'],
)
app.add_url_rule(
    '/api/github/public-repos',
    view_func=api_github_public_repos,
    methods=['GET', 'OPTIONS'],
)
app.register_blueprint(review_bp)
app.register_blueprint(issue_bp)
app.register_blueprint(feedback_bp)
app.register_blueprint(metrics_bp)
app.register_blueprint(repos_bp)
app.register_blueprint(analyze_bp)
app.register_blueprint(enriched_bp)
app.register_blueprint(gerrit_bp)
app.register_blueprint(analytics_bp)

@app.route('/health', methods=['GET'])
def health_check():
    """Liveness probe - is the process alive?"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    })

@app.route('/ready', methods=['GET'])
def ready_check():
    """Readiness probe - is the app ready to serve traffic?"""
    health = {"status": "ready", "checks": []}
    ready = True

    # 1. Check Database
    try:
        from models import db
        db.session.execute(text('SELECT 1'))
        health["checks"].append({"name": "database", "status": "ok"})
    except Exception as e:
        health["checks"].append({"name": "database", "status": "error", "message": str(e)})
        ready = False

    # 2. Check Redis
    try:
        from utils.limiter import limiter
        # Use a simple ping or check storage
        storage = limiter.storage
        if storage.check():
             health["checks"].append({"name": "redis", "status": "ok"})
        else:
             raise Exception("Storage check failed")
    except Exception as e:
        health["checks"].append({"name": "redis", "status": "error", "message": str(e)})
        ready = False

    status_code = 200 if ready else 503
    if not ready:
        health["status"] = "unready"
        
    return jsonify(health), status_code

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(
        debug=os.getenv('DEBUG', 'False').lower() == 'true',
        port=port,
        use_reloader=False,
        threaded=True,
    )
