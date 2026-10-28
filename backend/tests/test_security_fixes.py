import pytest
import os
import json
import uuid
import random
from main import app
from models import db, User, Repository, Review, Issue
from services.review_orchestrator import ReviewOrchestrator
from utils.encryption import encrypt_token, decrypt_token, _derive_key_legacy, Fernet
from routes.metrics import record_job, update_job, REDIS_KEY_JOBS


@pytest.fixture
def auth_fixture():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    client = app.test_client()

    with app.app_context():
        db.drop_all()
        db.create_all()

        rand_id = random.randint(10000, 99999)
        victim_id = str(uuid.uuid4())
        attacker_id = str(uuid.uuid4())

        victim = User(
            id=victim_id,
            github_id=rand_id,
            username=f"victim_{rand_id}",
            email=f"victim_{rand_id}@example.com"
        )
        victim.set_access_token("victim_token_123")

        attacker = User(
            id=attacker_id,
            github_id=rand_id + 1,
            username=f"attacker_{rand_id}",
            email=f"attacker_{rand_id}@example.com"
        )
        attacker.set_access_token("attacker_token_456")

        db.session.add_all([victim, attacker])
        db.session.commit()

        repo_id = str(uuid.uuid4())
        repo_full_name = f"{victim.username}/victim-repo"
        repo = Repository(
            id=repo_id,
            owner=victim.username,
            name="victim-repo",
            full_name=repo_full_name,
            installation_id=12345,
            connected_by=victim_id,
            config=json.dumps({"ai_mode": "standard"})
        )
        db.session.add(repo)
        db.session.commit()

        review_id = str(uuid.uuid4())
        review = Review(
            id=review_id,
            repository_id=repo_id,
            trigger_type="manual",
            status="completed",
            overall_health_score=85,
            category_scores=json.dumps({"security": 80})
        )
        db.session.add(review)
        db.session.commit()

        issue_id = str(uuid.uuid4())
        issue = Issue(
            id=issue_id,
            review_id=review_id,
            module="security",
            severity="critical",
            title="SQL Injection",
            file_path="app.py"
        )
        db.session.add(issue)
        db.session.commit()

        yield {
            "client": client,
            "victim_id": victim_id,
            "victim_username": victim.username,
            "attacker_id": attacker_id,
            "attacker_username": attacker.username,
            "attacker_login": attacker.username,
            "victim_login": victim.username,
            "repo_id": repo_id,
            "repo_full_name": repo_full_name,
            "review_id": review_id,
            "issue_id": issue_id
        }

        db.session.remove()
        db.drop_all()


def test_fix_3_unauthenticated_review_access_blocked(auth_fixture):
    """Issue 3: Unauthenticated caller must get 401 on /api/reviews/<id>."""
    client = auth_fixture["client"]
    resp = client.get(f'/api/reviews/{auth_fixture["review_id"]}')
    assert resp.status_code == 401
    assert resp.json.get("error") == "Unauthorized"


def test_fix_3_cross_tenant_review_access_blocked(auth_fixture):
    """Issue 3: Attacker must get 403 when attempting to access victim's review."""
    client = auth_fixture["client"]
    with client.session_transaction() as sess:
        sess['user'] = {
            'id': auth_fixture["attacker_id"],
            'login': auth_fixture["attacker_username"],
            'avatar_url': None
        }
    resp = client.get(f'/api/reviews/{auth_fixture["review_id"]}')
    assert resp.status_code == 403
    assert "Forbidden" in resp.json.get("error", "")


def test_fix_3_owner_can_access_own_review(auth_fixture):
    """Issue 3: Legitimate owner must get 200 when accessing own review."""
    client = auth_fixture["client"]
    with client.session_transaction() as sess:
        sess['user'] = {
            'id': auth_fixture["victim_id"],
            'login': auth_fixture["victim_username"],
            'avatar_url': None
        }
    resp = client.get(f'/api/reviews/{auth_fixture["review_id"]}')
    assert resp.status_code == 200
    assert resp.json.get("id") == auth_fixture["review_id"]


def test_fix_2_bola_disconnect_blocked(auth_fixture):
    """Issue 2: Attacker must get 403 when trying to disconnect victim's repo."""
    client = auth_fixture["client"]
    with client.session_transaction() as sess:
        sess['user'] = {
            'id': auth_fixture["attacker_id"],
            'login': auth_fixture["attacker_username"],
            'avatar_url': None
        }
    resp = client.post('/github/disconnect', json={
        "repo_full_name": auth_fixture["repo_full_name"]
    })
    assert resp.status_code == 403
    assert "Forbidden" in resp.json.get("error", "")

    # Verify repo still exists in DB
    with app.app_context():
        repo = Repository.query.get(auth_fixture["repo_id"])
        assert repo is not None


def test_fix_2_owner_can_disconnect(auth_fixture):
    """Issue 2: Owner can disconnect their own repo."""
    client = auth_fixture["client"]
    with client.session_transaction() as sess:
        sess['user'] = {
            'id': auth_fixture["victim_id"],
            'login': auth_fixture["victim_username"],
            'avatar_url': None
        }
    resp = client.post('/github/disconnect', json={
        "repo_full_name": auth_fixture["repo_full_name"]
    })
    assert resp.status_code == 200
    assert resp.json.get("success") is True


def test_fix_2_bola_update_settings_blocked(auth_fixture):
    """Issue 2: Attacker must get 403 when updating victim's repo settings."""
    client = auth_fixture["client"]
    with client.session_transaction() as sess:
        sess['user'] = {
            'id': auth_fixture["attacker_id"],
            'login': auth_fixture["attacker_username"],
            'avatar_url': None
        }
    resp = client.put(f'/api/repos/{auth_fixture["repo_id"]}/settings', json={
        "ai_mode": "hacked"
    })
    assert resp.status_code == 403
    assert "Forbidden" in resp.json.get("error", "")


def test_fix_2_owner_can_update_settings(auth_fixture):
    """Issue 2: Owner can update their own repo settings."""
    client = auth_fixture["client"]
    with client.session_transaction() as sess:
        sess['user'] = {
            'id': auth_fixture["victim_id"],
            'login': auth_fixture["victim_username"],
            'avatar_url': None
        }
    resp = client.put(f'/api/repos/{auth_fixture["repo_id"]}/settings', json={
        "ai_mode": "pro"
    })
    assert resp.status_code == 200
    assert resp.json.get("success") is True


def test_fix_1_bola_apply_fix_blocked(auth_fixture):
    """Issue 1: Attacker must get 403 when attempting to apply fix on victim's repo."""
    client = auth_fixture["client"]
    with client.session_transaction() as sess:
        sess['user'] = {
            'id': auth_fixture["attacker_id"],
            'login': auth_fixture["attacker_username"],
            'avatar_url': None
        }
    resp = client.post('/github/fix/apply', json={
        "issue_id": auth_fixture["issue_id"]
    })
    assert resp.status_code == 403
    assert "Forbidden" in resp.json.get("error", "")


def test_fix_1_bola_preview_fix_blocked(auth_fixture):
    """Issue 1: Attacker must get 403 when attempting to preview fix on victim's repo."""
    client = auth_fixture["client"]
    with client.session_transaction() as sess:
        sess['user'] = {
            'id': auth_fixture["attacker_id"],
            'login': auth_fixture["attacker_username"],
            'avatar_url': None
        }
    resp = client.post('/github/fix/preview', json={
        "issue_id": auth_fixture["issue_id"]
    })
    assert resp.status_code == 403
    assert "Forbidden" in resp.json.get("error", "")


def test_fix_4_deduplication_dict_evidence_and_no_line():
    """RISK-04: Deduplication handles dict evidence without TypeError and preserves distinct line=None findings."""
    orchestrator = ReviewOrchestrator()
    findings = [
        # Two duplicate findings with dictionary evidence
        {
            "file": "db.py",
            "line": 10,
            "category": "security",
            "tool": "semgrep",
            "evidence": [{"type": "sql", "statement": "SELECT * FROM users"}]
        },
        {
            "file": "db.py",
            "line": 10,
            "category": "security",
            "tool": "bandit",
            "evidence": [{"type": "sql", "statement": "SELECT * FROM users"}]
        },
        # Two distinct findings without line numbers
        {
            "file": "architecture.py",
            "line": None,
            "category": "architecture",
            "title": "Circular dependency detected",
            "tool": "arch_checker"
        },
        {
            "file": "architecture.py",
            "line": None,
            "category": "architecture",
            "title": "High coupling between modules",
            "tool": "arch_checker"
        }
    ]

    deduped = orchestrator._deduplicate_findings(findings)
    # The two line 10 findings merge into 1. The two line=None findings remain distinct!
    assert len(deduped) == 3
    # Check that evidence was merged as a list
    merged_finding = next(f for f in deduped if f["line"] == 10)
    assert len(merged_finding["evidence"]) == 1
    assert merged_finding["evidence"][0]["type"] == "sql"


def test_fix_6_multifernet_encryption_and_backward_compatibility():
    """RISK-06: Encryption uses SHA-256 derivation while preserving backward compatibility for legacy keys."""
    token = "ghp_super_secret_github_token_999"
    ciphertext = encrypt_token(token)
    assert ciphertext is not None
    decrypted = decrypt_token(ciphertext)
    assert decrypted == token

    # Test decrypting a legacy token created using old padded key
    secret = os.getenv('TOKEN_ENCRYPTION_KEY') or os.getenv('FLASK_SECRET_KEY', 'codebuster-secret-key-change-in-production')
    legacy_key = _derive_key_legacy(secret)
    legacy_cipher = Fernet(legacy_key).encrypt(token.encode('utf-8')).decode('utf-8')
    assert decrypt_token(legacy_cipher) == token


def test_fix_7_semantic_severity_sort_order(auth_fixture):
    """RISK-07: Issues must sort by critical -> major -> minor -> info (not alphabetical)."""
    client = auth_fixture["client"]
    review_id = auth_fixture["review_id"]

    with app.app_context():
        i_info = Issue(
            id=str(uuid.uuid4()),
            review_id=review_id,
            module="quality",
            severity="info",
            title="Style warning",
            file_path="style.py"
        )
        i_major = Issue(
            id=str(uuid.uuid4()),
            review_id=review_id,
            module="security",
            severity="major",
            title="Weak hashing",
            file_path="crypto.py"
        )
        i_minor = Issue(
            id=str(uuid.uuid4()),
            review_id=review_id,
            module="quality",
            severity="minor",
            title="Unused variable",
            file_path="main.py"
        )
        db.session.add_all([i_info, i_major, i_minor])
        db.session.commit()

    with client.session_transaction() as sess:
        sess['user'] = {
            'id': auth_fixture["victim_id"],
            'login': auth_fixture["victim_username"],
            'avatar_url': None
        }

    resp = client.get(f'/api/reviews/{review_id}/issues?sort=severity')
    assert resp.status_code == 200
    severities = [i['severity'] for i in resp.json.get('items', [])]
    # Existing fixture had 1 critical issue. With 3 added: critical -> major -> minor -> info
    assert severities == ['critical', 'major', 'minor', 'info']


def test_multi_tenant_reviews_and_issues_isolation(auth_fixture):
    """Tenant isolation: Attacker cannot see Victim's reviews or issues."""
    client = auth_fixture["client"]
    # 1. Attacker calls GET /api/reviews -> should get empty list
    with client.session_transaction() as sess:
        sess['user'] = {
            'id': auth_fixture["attacker_id"],
            'login': auth_fixture["attacker_username"],
            'avatar_url': None
        }
    resp_reviews = client.get('/api/reviews')
    assert resp_reviews.status_code == 200
    assert len(resp_reviews.json.get("reviews", [])) == 0

    # 2. Attacker calls GET /api/issues -> should get empty list
    resp_issues = client.get('/api/issues')
    assert resp_issues.status_code == 200
    assert len(resp_issues.json.get("data", [])) == 0

    # 3. Attacker calls GET /api/issues/<victim_issue_id> -> should get 403
    resp_single = client.get(f'/api/issues/{auth_fixture["issue_id"]}')
    assert resp_single.status_code == 403


def test_github_app_jwt_issuer_type_and_token_generation(monkeypatch):
    """Verify GitHub App JWT has string 'iss' claim compliant with PyJWT and RFC 7519."""
    import jwt
    from utils.config_loader import settings
    from utils.github_auth import generate_app_jwt
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization

    monkeypatch.setattr(settings, 'GITHUB_APP_ID', '123456')
    try:
        settings.get_private_key()
    except ValueError:
        priv_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        pem = priv_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode('utf-8')
        monkeypatch.setattr(settings, 'GITHUB_APP_PRIVATE_KEY', pem)

    token = generate_app_jwt()
    assert token is not None
    assert isinstance(token, str)
    decoded = jwt.decode(token, options={"verify_signature": False})
    assert isinstance(decoded.get("iss"), str)


def test_trufflehog_scanner_path_traversal_blocked():
    """Verify TruffleHogScanner blocks path traversal attempts."""
    from services.trufflehog_scanner import TruffleHogScanner
    import tempfile
    scanner = TruffleHogScanner(binary_path="echo")
    
    # Try to escape into tempdir's parent
    malicious_files = [{
        "path": "../../escaped_test_file.txt",
        "content": "TEST_TRAVERSAL_CONTENT"
    }]

    scanner.analyze(malicious_files)
    escaped_probe = os.path.join(tempfile.gettempdir(), "escaped_test_file.txt")
    escaped_exists = os.path.exists(escaped_probe)
    if escaped_exists:
        os.remove(escaped_probe)
    assert not escaped_exists, "Path traversal must be blocked"


def test_secret_redaction_targets_secret_literal():
    """Verify FixService._redact_secret redacts the secret token, not preceding message."""
    from services.fix_service import FixService
    fixer = FixService(access_token="dummy_test_token")
    fake_secret = "sk_" + "live_" + "x" * 24
    code = f'logger.info("Connecting to DB", auth_token="{fake_secret}")\n'
    new_content, summary = fixer._redact_secret(
        full_content=code,
        file_path="app/config.py",
        line_number=1,
        issue_title="Stripe Secret Key"
    )
    assert fake_secret not in new_content
    assert 'logger.info("Connecting to DB"' in new_content


def test_cross_tenant_repos_and_analytics_bola_blocked(client, auth_fixture):
    """Verify attacker cannot view victim reviews, issues, health, commits, or analytics."""
    with client.session_transaction() as sess:
        sess['user'] = {'id': auth_fixture['attacker_id'], 'login': auth_fixture['attacker_login']}

    victim_repo_id = auth_fixture['repo_id']
    victim_review_id = auth_fixture['review_id']

    # 1. GET /api/repos/<id>/reviews
    r = client.get(f'/api/repos/{victim_repo_id}/reviews')
    assert r.status_code == 403

    # 2. GET /api/repos/<id>/reviews/<rid>/issues
    r = client.get(f'/api/repos/{victim_repo_id}/reviews/{victim_review_id}/issues')
    assert r.status_code == 403

    # 3. GET /api/repos/<id>/health
    r = client.get(f'/api/repos/{victim_repo_id}/health')
    assert r.status_code == 403

    # 4. GET /api/repos/<id>/commits
    r = client.get(f'/api/repos/{victim_repo_id}/commits')
    assert r.status_code == 403

    # 5. GET /api/repos/<id>/analytics/issues-by-category
    r = client.get(f'/api/repos/{victim_repo_id}/analytics/issues-by-category')
    assert r.status_code == 403

    # 6. POST /api/feedback on victim issue
    r = client.post('/api/feedback', json={
        'issue_id': auth_fixture['issue_id'],
        'review_id': victim_review_id,
        'action': 'dismiss'
    })
    assert r.status_code == 403


def test_oauth_state_parameter_generation_and_validation(client):
    """Verify OAuth endpoint generates state parameter and rejects callbacks without valid state."""
    r = client.get('/auth/github')
    assert r.status_code == 200
    auth_url = r.json.get('auth_url')
    assert 'state=' in auth_url

    # Attempt callback with invalid state
    r_bad = client.get('/auth/callback?code=fake_code&state=invalid_csrf_state')
    assert r_bad.status_code == 400
    assert 'CSRF' in r_bad.json.get('error', '')
