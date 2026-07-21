import os
import redis
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

print("REDIS_URL =", os.environ.get("REDIS_URL"))

r = redis.Redis.from_url(
    os.environ["REDIS_URL"],
    decode_responses=True
)

print("PING:", r.ping())
