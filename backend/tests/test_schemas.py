import unittest
from models.schemas import ReviewRequestSchema, JobResponseSchema
from pydantic import ValidationError

class TestSchemas(unittest.TestCase):
    def test_review_request_valid(self):
        data = {
            "repository_id": "repo-123",
            "files": ["src/app.py"]
        }
        schema = ReviewRequestSchema(**data)
        self.assertEqual(schema.repository_id, "repo-123")
        self.assertEqual(schema.branch, "main")

    def test_review_request_invalid(self):
        data = {
            "files": ["src/app.py"]
        }
        with self.assertRaises(ValidationError):
            ReviewRequestSchema(**data)

    def test_job_response(self):
        data = {"job_id": "job-456"}
        schema = JobResponseSchema(**data)
        self.assertEqual(schema.status, "queued")

if __name__ == '__main__':
    unittest.main()
