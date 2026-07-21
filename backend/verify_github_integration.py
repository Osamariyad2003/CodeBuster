import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import requests

# Add current dir to path so we can import app and utils
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.github_auth import generate_app_jwt, get_installation_access_token
from app.redis_client import get_redis
from app.token_cache import get_installation_token

# Load env (utils/github_auth.py loads it too, but good to be explicit for the script)
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

def verify():
    print("[SEARCH] Verifying GitHub App Integration & Redis...\n")

    # 1. Check Redis Connection
    print("1. Checking Redis Connection...")
    try:
        r = get_redis()
        r.ping()
        print("   [OK] Redis is connected.")
    except Exception as e:
        print(f"   [ERR] Redis connection failed: {e}")
        return

    # 2. Check App JWT Generation
    print("\n2. Checking GitHub App JWT Generation...")
    jwt_token = generate_app_jwt()
    if jwt_token:
        print("   [OK] JWT generated successfully.")
    else:
        print("   [ERR] Failed to generate JWT. Check GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY_PATH in .env")
        return

    # 3. List Installations
    print("\n3. Fetching App Installations (GitHub API)...")
    headers = {
        'Authorization': f'Bearer {jwt_token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    try:
        resp = requests.get('https://api.github.com/app/installations', headers=headers, timeout=10)
        if resp.status_code == 200:
            installations = resp.json()
            count = len(installations)
            print(f"   [OK] Found {count} installations.")
            
            if count > 0:
                inst_id = installations[0]['id']
                account = installations[0]['account']['login']
                print(f"   [INFO]️  Testing with installation ID: {inst_id} (Account: {account})")

                # 4. Test Token Retrieval & Caching
                print(f"\n4. Fetching Access Token for Installation {inst_id}...")
                
                # Clear cache first to test retrieval
                key = f"gh:inst_token:{inst_id}"
                r.delete(key)
                
                token = get_installation_access_token(inst_id)
                if token:
                    print("   [OK] Token retrieved from GitHub.")
                    
                    # 5. Verify Cache
                    print("   Checking Redis Cache...")
                    cached = get_installation_token(r, inst_id)
                    if cached == token:
                        print("   [OK] Token successfully cached in Redis!")
                    else:
                        print(f"   [ERR] Token not found in Redis (Got: {cached})")
                else:
                    print("   [ERR] Failed to get installation token.")
        else:
            print(f"   [ERR] Failed to fetch installations: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"   [ERR] API Request failed: {e}")

if __name__ == "__main__":
    verify()
