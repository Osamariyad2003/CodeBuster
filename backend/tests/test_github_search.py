import unittest
from unittest.mock import patch

from main import app
from models import db, User, Repository


class GithubSearchTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.client = app.test_client()

        with app.app_context():
            db.create_all()

            # Seed a user and a connected repository with an installation_id
            user = User(
                github_id=123,
                username="tester",
                email="tester@example.com",
            )
            db.session.add(user)
            db.session.commit()

            repo = Repository(
                owner="owner",
                name="repo",
                full_name="owner/repo",
                github_repo_id=1,
                installation_id=999,
                connected_by=user.id,
            )
            db.session.add(repo)
            db.session.commit()

            self.user_id = user.id
            self.username = user.username
            self.installation_id = repo.installation_id

        # Log the user in by seeding session data
        with self.client.session_transaction() as sess:
            sess["user"] = {"login": self.username}

    def tearDown(self):
        with app.app_context():
            db.drop_all()

    def test_public_search_rejects_short_query(self):
        resp = self.client.get("/github/public-repos?query=a")
        self.assertEqual(resp.status_code, 422)

    def test_public_search_happy_path(self):
        from routes import github as github_routes

        class FakeResponse:
            def __init__(self):
                self.status_code = 200
                self._json = {
                    "total_count": 1,
                    "items": [
                        {
                            "id": 1,
                            "full_name": "owner/repo",
                            "html_url": "https://github.com/owner/repo",
                            "description": "Test repo",
                            "stargazers_count": 42,
                            "language": "Python",
                            "updated_at": "2024-01-01T00:00:00Z",
                            "owner": {
                                "login": "owner",
                                "avatar_url": "https://example.com/avatar.png",
                            },
                        }
                    ],
                }
                self.text = "ok"

            def json(self):
                return self._json

        with patch.object(
            github_routes, "github_search_public_repositories", return_value=FakeResponse()
        ):
            resp = self.client.get("/github/public-repos?query=test&page=1&per_page=10")
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertEqual(data["source"], "public")
            self.assertEqual(data["total_count"], 1)
            self.assertEqual(len(data["items"]), 1)
            item = data["items"][0]
            self.assertEqual(item["full_name"], "owner/repo")
            self.assertEqual(item["owner"]["login"], "owner")

    def test_installed_search_uses_installation_mapping(self):
        from routes import github as github_routes

        def fake_get_installation_access_token(installation_id):
            # Ensure we are called with the user's installation_id
            assert installation_id == self.installation_id
            return "fake-token"

        def fake_list_installation_repositories(installation_id, access_token, per_page=100, max_pages=10):
            assert installation_id == self.installation_id
            self.assertEqual(access_token, "fake-token")
            return [
                {
                    "id": 1,
                    "full_name": "owner/repo",
                    "html_url": "https://github.com/owner/repo",
                    "description": "Installed repo",
                    "stargazers_count": 5,
                    "language": "Python",
                    "updated_at": "2024-01-01T00:00:00Z",
                    "owner": {
                        "login": "owner",
                        "avatar_url": "https://example.com/avatar.png",
                    },
                }
            ]

        with patch.object(
            github_routes,
            "get_installation_access_token",
            side_effect=fake_get_installation_access_token,
        ), patch.object(
            github_routes,
            "list_installation_repositories",
            side_effect=fake_list_installation_repositories,
        ):
            resp = self.client.get("/github/installed-repos?query=owner&page=1&per_page=10")
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertEqual(data["source"], "installed")
            self.assertEqual(data["total_estimate"], 1)
            self.assertEqual(len(data["items"]), 1)
            item = data["items"][0]
            self.assertEqual(item["full_name"], "owner/repo")
            self.assertTrue(item["is_connected"])


if __name__ == "__main__":
    unittest.main()

