from workers.analyzers.base import run_stub


def run(repo_full_name: str, commit_sha: str, **kwargs) -> list:
    return run_stub("devops", repo_full_name, commit_sha, "INFO", "Stub: CI/CD and IaC checks")
