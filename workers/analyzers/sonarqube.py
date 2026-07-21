"""Worker-side SonarQube analyzer — fetches issues via the SonarQube API."""
from workers.analyzers.base import finding


def run(repo_full_name: str, commit_sha: str, **kwargs) -> list:
    """Run SonarQube analysis via API. Requires SONARQUBE_URL and SONARQUBE_TOKEN env vars."""
    try:
        from backend.services.sonarqube_analyzer import SonarQubeAnalyzer
    except ImportError:
        return [finding(
            id="sonarqube-import-error",
            severity="INFO",
            category="sonarqube",
            module="code_quality",
            message="SonarQube analyzer not available (import error).",
            file="",
            start_line=0,
            confidence=0,
        )]

    project_key = repo_full_name.replace("/", "_")
    analyzer = SonarQubeAnalyzer(project_key=project_key)
    raw_findings = analyzer.analyze()

    results = []
    for f in raw_findings:
        results.append(finding(
            id=f.get('id', ''),
            severity=f.get('severity', 'minor').upper(),
            category='sonarqube_' + f.get('category', 'code_quality'),
            module=f.get('module', 'code_quality'),
            message=f.get('description', ''),
            file=f.get('file', ''),
            start_line=f.get('line', 0),
            confidence=f.get('confidence', 0.85),
            rule_id=f.get('rule_id', ''),
        ))
    return results
