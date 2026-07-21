#!/usr/bin/env python3
"""
GitHub App Setup Verification Script
Run this to verify your GitHub App configuration is correct.
"""

import os
import sys
from dotenv import load_dotenv
import jwt
import time
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

def print_status(message, success=True):
    """Print colored status message."""
    symbol = "[OK]" if success else "[ERR]"
    print(f"{symbol} {message}")

def print_section(title):
    """Print section header."""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def verify_env_variables():
    """Check if required environment variables are set."""
    print_section("Checking Environment Variables")
    
    required_vars = {
        'GITHUB_APP_ID': 'GitHub App ID',
        'GITHUB_APP_PRIVATE_KEY': 'GitHub App Private Key',
        'GITHUB_WEBHOOK_SECRET': 'Webhook Secret',
        'FLASK_SECRET_KEY': 'Flask Secret Key'
    }
    
    all_good = True
    
    for var, description in required_vars.items():
        value = os.getenv(var)
        if value and value not in ['your-app-id', 'your-webhook-secret', '', 'your-super-secret-flask-key-change-this']:
            print_status(f"{description}: Set", True)
        else:
            print_status(f"{description}: Missing or not configured", False)
            all_good = False
    
    return all_good

def verify_private_key_format():
    """Verify the private key is properly formatted."""
    print_section("Verifying Private Key Format")
    
    private_key = os.getenv('GITHUB_APP_PRIVATE_KEY', '')
    
    if not private_key:
        print_status("Private key is empty", False)
        return False
    
    # Check for PEM headers
    if '-----BEGIN RSA PRIVATE KEY-----' in private_key:
        print_status("Private key has correct BEGIN header", True)
    else:
        print_status("Private key missing BEGIN header", False)
        return False
    
    if '-----END RSA PRIVATE KEY-----' in private_key:
        print_status("Private key has correct END header", True)
    else:
        print_status("Private key missing END header", False)
        return False
    
    # Check key length (rough estimate)
    key_length = len(private_key)
    if key_length > 1600:  # Typical RSA key is ~1700 chars
        print_status(f"Private key length looks good ({key_length} chars)", True)
    else:
        print_status(f"Private key seems too short ({key_length} chars)", False)
        return False
    
    return True

def verify_jwt_generation():
    """Try to generate a JWT token."""
    print_section("Testing JWT Token Generation")
    
    app_id = os.getenv('GITHUB_APP_ID')
    private_key = os.getenv('GITHUB_APP_PRIVATE_KEY')
    
    if not app_id or not private_key:
        print_status("Cannot test JWT - missing credentials", False)
        return False
    
    try:
        now = int(time.time())
        payload = {
            'iat': now,
            'exp': now + 600,
            'iss': app_id
        }
        
        token = jwt.encode(payload, private_key, algorithm='RS256')
        
        if token:
            print_status("Successfully generated JWT token", True)
            print(f"   Token preview: {token[:50]}...")
            
            # Verify we can decode it
            decoded = jwt.decode(token, private_key, algorithms=['RS256'], options={"verify_signature": False})
            print_status(f"Token expires in {decoded['exp'] - now} seconds", True)
            return True
        else:
            print_status("Failed to generate JWT token", False)
            return False
            
    except jwt.exceptions.InvalidKeyError as e:
        print_status(f"Invalid private key format: {str(e)}", False)
        return False
    except Exception as e:
        print_status(f"Error generating JWT: {str(e)}", False)
        return False

def verify_dependencies():
    """Check if required Python packages are installed."""
    print_section("Checking Python Dependencies")
    
    required_packages = {
        'flask': 'Flask',
        'flask_cors': 'Flask-CORS',
        'requests': 'Requests',
        'jwt': 'PyJWT',
        'cryptography': 'Cryptography',
        'dotenv': 'python-dotenv'
    }
    
    all_good = True
    
    for package, name in required_packages.items():
        try:
            __import__(package)
            print_status(f"{name}: Installed", True)
        except ImportError:
            print_status(f"{name}: NOT installed", False)
            all_good = False
    
    return all_good

def main():
    """Run all verification checks."""
    print("\n" + "="*60)
    print("  [BOT] CodeBuster GitHub App Setup Verification")
    print("="*60)
    
    # Check if .env file exists
    if not os.path.exists('.env'):
        print("\n[ERR] ERROR: .env file not found!")
        print("   Please copy config_template.env to .env and configure it.")
        print("   Command: cp config_template.env .env")
        return False
    else:
        print_status(".env file found")
    
    # Run all checks
    checks = [
        ("Dependencies", verify_dependencies),
        ("Environment Variables", verify_env_variables),
        ("Private Key Format", verify_private_key_format),
        ("JWT Generation", verify_jwt_generation)
    ]
    
    results = []
    for check_name, check_func in checks:
        try:
            result = check_func()
            results.append(result)
        except Exception as e:
            print_status(f"{check_name} check failed: {str(e)}", False)
            results.append(False)
    
    # Final summary
    print_section("Summary")
    
    if all(results):
        print("[OK] All checks passed! Your GitHub App setup is ready.")
        print("\n[NOTE] Next steps:")
        print("   1. Install the GitHub App on your repositories")
        print("   2. Start the backend: python app.py")
        print("   3. Start the frontend: cd frontend && npm run dev")
        print("   4. Create a test PR to see CodeBuster in action!")
        return True
    else:
        print("[ERR] Some checks failed. Please review the errors above.")
        print("\n[?] Documentation:")
        print("   - Full guide: backend/GITHUB_APP_SETUP.md")
        print("   - Quick start: backend/QUICK_START.md")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)

