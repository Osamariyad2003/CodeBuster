import os
os.environ["DATABASE_URL"] = "sqlite:///test_codebuster.db"
os.environ["DEBUG"] = "False"
os.environ["GITHUB_APP_ID"] = "12345"
os.environ["GITHUB_WEBHOOK_SECRET"] = "test-secret"
os.environ["FLASK_SECRET_KEY"] = "test-secret"

import pytest
from main import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    return app.test_client()
