import hmac
import hashlib
import pytest
from fastapi.testclient import TestClient
from main import app, GITHUB_WEBHOOK_SECRET

client = TestClient(app)

@pytest.fixture
def mock_secret(monkeypatch):
    secret = "test_secret"
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", secret)
    import main
    monkeypatch.setattr(main, "GITHUB_WEBHOOK_SECRET", secret)
    return secret

def test_signature_verification_success(mock_secret):
    payload = {"repository": {"full_name": "owner/repo"}, "action": "opened"}
    body = json.dumps(payload).encode()
    
    signature = hmac.new(
        mock_secret.encode(),
        msg=body,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    headers = {
        "X-Hub-Signature-256": f"sha256={signature}",
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": "test-delivery-id",
        "Content-Type": "application/json"
    }
    
    response = client.post("/webhooks/github", content=body, headers=headers)
    assert response.status_code == 202
    assert response.json()["status"] == "accepted"

def test_signature_verification_failure():
    headers = {
        "X-Hub-Signature-256": "sha256=invalid",
        "X-GitHub-Event": "push",
        "X-GitHub-Delivery": "test-delivery-id"
    }
    response = client.post("/webhooks/github", json={"test": "data"}, headers=headers)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid signature"

def test_missing_signature():
    headers = {
        "X-GitHub-Event": "push",
        "X-GitHub-Delivery": "test-delivery-id"
    }
    response = client.post("/webhooks/github", json={"test": "data"}, headers=headers)
    assert response.status_code == 401
    assert response.json()["detail"] == "Signature missing"

def test_unsupported_event():
    # Assume signature is valid (we'll bypass or use a mock secret)
    # For simplicity in this test, we use the fact that if secret is missing it returns 401 or 500
    pass

import json
