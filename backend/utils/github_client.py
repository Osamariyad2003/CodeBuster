import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os

_BLOCKED_DIR_NAMES = {
    'node_modules', 'dist', 'build', 'out', 'vendor',
    '__pycache__', 'venv', '.venv', 'site-packages',
    'windows', 'ephemeral', 'netlify',
}

def _should_skip_path(path: str) -> bool:
    """Return True if the file path contains a blocklisted or hidden directory."""
    parts = path.replace('\\', '/').split('/')
    dirs = parts[:-1]  # everything except the filename
    for d in dirs:
        if d in _BLOCKED_DIR_NAMES or d.startswith('.'):
            return True
    return False

def get_github_session():
    """
    Create a requests Session with robust retry logic and timeouts.
    Retries on: 429, 500, 502, 503, 504
    Timeouts: configurable via env; default 25s connect, 60s read (for slow networks).
    """
    session = requests.Session()

    retries = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "PUT", "DELETE", "OPTIONS", "TRACE", "POST"]
    )

    adapter = HTTPAdapter(max_retries=retries)
    session.mount("https://", adapter)
    session.mount("http://", adapter)

    return session

# Timeouts (connect, read). Override with GITHUB_CONNECT_TIMEOUT / GITHUB_READ_TIMEOUT if needed.
_connect = int(os.environ.get("GITHUB_CONNECT_TIMEOUT", "25"))
_read = int(os.environ.get("GITHUB_READ_TIMEOUT", "60"))
GITHUB_TIMEOUT = (_connect, _read)

def fetch_pr_files(repo_full_name, pr_number, access_token):
    """
    Fetch changed files for a PR.
    Returns a list of dicts: [{'path': '...', 'content': '...'}, ...]
    """
    url = f"https://api.github.com/repos/{repo_full_name}/pulls/{pr_number}/files"
    headers = {
        'Authorization': f'token {access_token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    files = []
    page = 1
    session = get_github_session()
    
    while True:
        try:
            response = session.get(f"{url}?per_page=100&page={page}", headers=headers, timeout=GITHUB_TIMEOUT)
            if response.status_code != 200:
                print(f"[ERR] Failed to fetch PR files: {response.status_code}")
                break
                
            data = response.json()
            if not data:
                break
                
            for file_info in data:
                # Skip deleted files or non-code files if needed (analyzer handles filtering usually)
                if file_info['status'] == 'removed':
                    continue

                file_path = file_info['filename']
                if _should_skip_path(file_path):
                    continue

                content_url = file_info.get('contents_url')
                if content_url:
                    c_res = session.get(content_url, headers=headers, timeout=GITHUB_TIMEOUT)
                    if c_res.status_code == 200:
                        c_data = c_res.json()
                        content = ""
                        if c_data.get('encoding') == 'base64':
                            try:
                                import base64
                                content = base64.b64decode(c_data['content']).decode('utf-8')
                            except Exception:
                                content = "" # Binary or error
                        
                        files.append({
                            'path': file_info['filename'],
                            'content': content
                        })
            
            if len(data) < 100:
                break
            page += 1
        except Exception as e:
            print(f"[ERR] Error fetching PR files: {e}")
            break
            
    return files

def fetch_all_repo_files(repo_full_name, branch, access_token):
    """
    Fetch all files for a repository (recursive tree).
    Returns a list of dicts: [{'path': '...', 'content': '...'}, ...]
    """
    # 1. Get the recursive tree for the branch
    tree_url = f"https://api.github.com/repos/{repo_full_name}/git/trees/{branch}?recursive=1"
    headers = {
        'Authorization': f'token {access_token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    session = get_github_session()
    
    try:
        response = session.get(tree_url, headers=headers, timeout=GITHUB_TIMEOUT)
        if response.status_code != 200:
            print(f"[ERR] Failed to fetch repo tree: {response.status_code}")
            return []
            
        tree_data = response.json()
        files = []
        
        # Whole-code review: include all common source/config extensions so orchestrator reads the full repo
        code_extensions = {
            '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.yaml', '.yml', '.json', '.md',
            '.java', '.go', '.rb', '.php', '.vue', '.svelte', '.rs', '.c', '.cpp', '.h', '.hpp', '.cc', '.cxx',
            '.sh', '.bash', '.sql', '.kt', '.kts', '.swift', '.m', '.scala', '.r', '.R', '.lua', '.pl', '.pm',
            '.ex', '.exs', '.erl', '.hrl', '.hs', '.fs', '.fsx', '.vb', '.cs', '.dart', '.groovy', '.gradle',
            '.tf', '.tfvars', '.toml', '.ini', '.cfg', '.conf', '.env', '.dockerfile', '.graphql', '.gql',
        }
        
        for item in tree_data.get('tree', []):
            if item['type'] == 'blob':
                path = item['path']
                # Basic filtering: only fetch code files and ignore common noise
                has_valid_ext = any(path.lower().endswith(ext) for ext in code_extensions)
                if not has_valid_ext:
                    continue
                if _should_skip_path(path):
                    continue
                    
                # Fetch content
                content_url = item.get('url') # This is the blob URL
                if content_url:
                    c_res = session.get(content_url, headers=headers, timeout=GITHUB_TIMEOUT)
                    if c_res.status_code == 200:
                        c_data = c_res.json()
                        content = ""
                        if c_data.get('encoding') == 'base64':
                            try:
                                import base64
                                # Note: For very large repos, this sequential fetch might be slow.
                                content = base64.b64decode(c_data['content']).decode('utf-8')
                            except Exception:
                                continue # Skip binary or decoding errors
                        
                        files.append({
                            'path': path,
                            'content': content
                        })
    except Exception as e:
        print(f"[ERR] Error fetching repo files: {e}")
        return []
    
    return files

def fetch_repo_commits(repo_full_name, access_token, per_page=30, page=1):
    """
    Fetch commit history for a repository.
    Returns a list of commit objects or empty list on error.
    """
    url = f"https://api.github.com/repos/{repo_full_name}/commits"
    headers = {
        'Authorization': f'token {access_token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    params = {
        'per_page': per_page,
        'page': page
    }
    
    session = get_github_session()
    
    try:
        response = session.get(url, headers=headers, params=params, timeout=GITHUB_TIMEOUT)
        if response.status_code == 200:
            commits = response.json()
            print(f"[OK] Fetched {len(commits)} commits for {repo_full_name}")
            return commits
        elif response.status_code == 404:
            print(f"[ERR] Repository {repo_full_name} not found (404)")
            return []
        elif response.status_code == 403:
            print(f"[ERR] Access forbidden for {repo_full_name} (403) - check token permissions")
            return []
        else:
            print(f"[ERR] Failed to fetch commits: {response.status_code} - {response.text[:200]}")
            return []
    except requests.exceptions.Timeout:
        print(f"[ERR] Timeout fetching commits for {repo_full_name}")
        return []
    except Exception as e:
        print(f"[ERR] Error fetching commits: {str(e)}")
        import traceback
        traceback.print_exc()
        return []


def list_installation_repositories(installation_id, access_token, per_page=100, max_pages=10):
    """
    List repositories for a GitHub App installation.
    Uses the official installation repositories endpoint and paginates.
    Returns a list of raw GitHub repo objects.
    """
    session = get_github_session()
    url = "https://api.github.com/installation/repositories"
    headers = {
        "Authorization": f"token {access_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    repos = []
    page = 1

    # Use a stricter timeout for search-style operations
    search_timeout = (
        int(os.environ.get("GITHUB_SEARCH_CONNECT_TIMEOUT", "5")),
        int(os.environ.get("GITHUB_SEARCH_READ_TIMEOUT", "10")),
    )

    while page <= max_pages:
        try:
            resp = session.get(
                url,
                headers=headers,
                params={"per_page": per_page, "page": page},
                timeout=search_timeout,
            )
        except requests.exceptions.Timeout:
            print(f"[ERR] Timeout listing installation repos for {installation_id} on page {page}")
            break
        except Exception as e:
            print(f"[ERR] Error listing installation repos for {installation_id}: {e}")
            break

        if resp.status_code != 200:
            print(
                f"[ERR] Failed to list installation repos for {installation_id}: "
                f"{resp.status_code} - {resp.text[:200]}"
            )
            break

        data = resp.json() or {}
        page_repos = data.get("repositories", [])
        if not page_repos:
            break

        repos.extend(page_repos)

        # Stop if fewer than requested were returned (no more pages)
        if len(page_repos) < per_page:
            break

        page += 1

    return repos


def search_public_repositories(query, page=1, per_page=20):
    """
    Search public GitHub repositories by keyword using the official
    GitHub Search API. Returns the raw Response object so callers
    can map status codes to friendly errors.
    """
    session = get_github_session()
    url = "https://api.github.com/search/repositories"
    params = {
        "q": f"{query} in:name,description",
        "page": page,
        "per_page": per_page,
        "sort": "stars",
        "order": "desc",
    }

    search_timeout = (
        int(os.environ.get("GITHUB_SEARCH_CONNECT_TIMEOUT", "5")),
        int(os.environ.get("GITHUB_SEARCH_READ_TIMEOUT", "10")),
    )

    try:
        resp = session.get(url, params=params, timeout=search_timeout)
    except requests.exceptions.Timeout:
        print(f"[ERR] Timeout searching public repos for query='{query}' page={page}")
        raise
    except Exception as e:
        print(f"[ERR] Error searching public repos for query='{query}': {e}")
        raise

    return resp
