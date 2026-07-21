import unittest
from main import app
from models import db, Repository, Review
import uuid

class TestIntegration(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.client = app.test_client()
        with app.app_context():
            db.create_all()
            # Seed a repo
            repo_name = f"repo-{uuid.uuid4().hex[:8]}"
            repo = Repository(
                id=str(uuid.uuid4()),
                owner="test",
                name=repo_name,
                full_name=f"test/{repo_name}",
                installation_id="123",
            )
            db.session.add(repo)
            self.repo_id = repo.id
            db.session.commit()

    def test_health_check(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertIn('status', response.json)

    def test_review_submission_unauthorized(self):
        # Should fail because login_required is active
        response = self.client.post('/api/reviews', json={
            "repository_id": self.repo_id,
            "files": ["test.py"]
        })
        self.assertEqual(response.status_code, 401)

if __name__ == '__main__':
    unittest.main()
