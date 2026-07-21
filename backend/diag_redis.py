import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path, override=True)
url = os.getenv('REDIS_URL')
print(f"DEBUG_URL: '{url}'")
if url:
    print(f"DEBUG_URL_BYTES: {url.encode()}")
else:
    print("REDIS_URL is None")
