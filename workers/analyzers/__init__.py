from workers.analyzers.security import run as run_security
from workers.analyzers.quality import run as run_quality
from workers.analyzers.performance import run as run_performance
from workers.analyzers.maintainability import run as run_maintainability
from workers.analyzers.devops import run as run_devops
from workers.analyzers.frontend import run as run_frontend
from workers.analyzers.sonarqube import run as run_sonarqube

ANALYZERS = {
    "security": run_security,
    "quality": run_quality,
    "performance": run_performance,
    "maintainability": run_maintainability,
    "devops": run_devops,
    "frontend": run_frontend,
    "sonarqube": run_sonarqube,
}
