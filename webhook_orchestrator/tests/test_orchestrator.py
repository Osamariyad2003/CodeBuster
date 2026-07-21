import hmac
import hashlib
import json
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

# Import after monkeypatching env if needed, but we'll patch the Config class
from app.main import app
from app.config import Config

client = TestClient(app)

@pytest.fixture
def mock_redis():
    with patch("app.main.redis_client") as mock:
        yield mock

@pytest.fixture
def mock_celery():
    with patch("app.main.process_github_event.delay") as mock:
        yield mock

def test_signature_verification_success(mock_redis, mock_celery):
    secret = "test_secret"
    with patch("app.main.Config.GITHUB_WEBHOOK_SECRET", secret):
        payload = {"repository": {"full_name": "owner/repo"}, "action": "opened"}
        body = json.dumps(payload).encode()
        
        signature = hmac.new(
            secret.encode(),
            msg=body,
            digestmod=hashlib.sha256
        ).hexdigest()
        
        headers = {
            "X-Hub-Signature-256": f"sha256={signature}",
            "X-GitHub-Event": "pull_request",
            "X-GitHub-Delivery": "unique-delivery-id",
            "Content-Type": "application/json"
        }
        
        # Mock Redis set to return True (is new)
        mock_redis.set.return_value = True
        
        response = client.post("/webhooks/github", content=body, headers=headers)
        assert response.status_code == 202
        assert response.json()["status"] == "accepted"
        mock_celery.assert_called_once()

def test_idempotency_deduplication(mock_redis):
    secret = "test_secret"
    with patch("app.main.Config.GITHUB_WEBHOOK_SECRET", secret):
        payload = {"repository": {"full_name": "owner/repo"}, "action": "opened"}
        body = json.dumps(payload).encode()
        
        signature = hmac.new(secret.encode(), msg=body, digestmod=hashlib.sha256).hexdigest()
        
        headers = {
            "X-Hub-Signature-256": f"sha256={signature}",
            "X-GitHub-Event": "pull_request",
            "X-GitHub-Delivery": "duplicate-id",
            "Content-Type": "application/json"
        }
        
        # Mock Redis set to return False (already exists)
        mock_redis.set.return_value = False
        
        response = client.post("/webhooks/github", content=body, headers=headers)
        assert response.status_code == 200
        assert response.json()["reason"] == "duplicate delivery"

def test_invalid_signature(mock_redis):
    with patch("app.main.Config.GITHUB_WEBHOOK_SECRET", "secret"):
        headers = {
            "X-Hub-Signature-256": "sha256=wrong",
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "id-123"
        }
        response = client.post("/webhooks/github", json={"test": "data"}, headers=headers)
        assert response.status_code == 401
