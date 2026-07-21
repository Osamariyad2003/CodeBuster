from workers.analyzers.base import run_stub


def run(repo_full_name: str, commit_sha: str, **kwargs) -> list:
    return run_stub("frontend", repo_full_name, commit_sha, "MINOR", "Stub: frontend a11y and best practices")
