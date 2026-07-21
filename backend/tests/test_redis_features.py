import unittest
from unittest.mock import MagicMock
from app.rate_limit import rate_limit
from app.idempotency import is_duplicate_delivery
from app.token_cache import get_installation_token, set_installation_token
import json
import time

class TestRedisFeatures(unittest.TestCase):
    def setUp(self):
        self.mock_redis = MagicMock()

    def test_rate_limit_allowed(self):
        # Setup: pipeline returns [1, 60] simulating first request
        self.mock_redis.pipeline.return_value.execute.return_value = [1, 60]
        
        allowed = rate_limit(self.mock_redis, "127.0.0.1", limit_per_minute=10)
        self.assertTrue(allowed)
        
    def test_rate_limit_exceeded(self):
        # Setup: pipeline returns [11, 50] simulating 11th request
        self.mock_redis.pipeline.return_value.execute.return_value = [11, 50]
        
        allowed = rate_limit(self.mock_redis, "127.0.0.1", limit_per_minute=10)
        self.assertFalse(allowed)

    def test_idempotency_new(self):
        # set returns True (or any truthy value if mapped) when key is new if we mock it that way,
        # but redis-py set(nx=True) returns True if set, None if not set.
        self.mock_redis.set.return_value = True
        
        is_dup = is_duplicate_delivery(self.mock_redis, "del_123")
        self.assertFalse(is_dup) # Not a duplicate
        self.mock_redis.set.assert_called_with("gh:delivery:del_123", "1", nx=True, ex=86400)

    def test_idempotency_duplicate(self):
        # set returns None when key exists
        self.mock_redis.set.return_value = None
        
        is_dup = is_duplicate_delivery(self.mock_redis, "del_123")
        self.assertTrue(is_dup) # Is a duplicate

    def test_token_cache(self):
        # dict get return None
        self.mock_redis.get.return_value = None
        self.assertIsNone(get_installation_token(self.mock_redis, 123))
        
        # cache hit
        self.mock_redis.get.return_value = json.dumps({"token": "abc"})
        self.assertEqual(get_installation_token(self.mock_redis, 123), "abc")

if __name__ == "__main__":
    unittest.main()
