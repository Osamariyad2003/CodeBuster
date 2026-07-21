"""Lighthouse Service - integrates with Lighthouse CI/CLI for automated web audits."""
import subprocess
import json
import tempfile
import os
import shutil
from typing import List, Dict, Any, Optional
import structlog

logger = structlog.get_logger()

class LighthouseService:
    """
    Executes Lighthouse audits against a live URL or local files.
    Standardizes output to CodeBuster Finding format.
    """

    def __init__(self, lighthouse_bin: str = "lighthouse"):
        self.lighthouse_bin = lighthouse_bin

    def run_audit(self, url: str) -> List[Dict[str, Any]]:
        """
        Runs a Lighthouse audit against a provided URL.
        
        Args:
            url: The public/staging URL to audit.
            
        Returns:
            List of findings in standard CodeBuster format.
        """
        temp_dir = tempfile.mkdtemp(prefix="codebuster_lighthouse_")
        report_path = os.path.join(temp_dir, "report.json")
        
        try:
            # Command to run Lighthouse in headless mode
            # --output=json: Get structured data
            # --chrome-flags="--headless": Run without UI
            cmd = [
                self.lighthouse_bin,
                url,
                "--output=json",
                f"--output-path={report_path}",
                "--chrome-flags=--headless --no-sandbox",
                "--quiet",
                "--only-categories=performance,accessibility,best-practices,seo"
            ]

            logger.info("running_lighthouse_audit", url=url)
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            
            if os.path.exists(report_path):
                with open(report_path, "r", encoding="utf-8") as f:
                    raw_report = json.load(f)
                    return self._parse_report(raw_report)
            else:
                logger.error("lighthouse_report_not_generated", stderr=result.stderr)
                return []

        except Exception as e:
            logger.error("lighthouse_execution_failed", error=str(e))
            return []
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def _parse_report(self, report: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parses a raw Lighthouse JSON report into CodeBuster findings."""
        findings = []
        audits = report.get("audits", {})
        
        # We focus on audits that failed (score < 0.9 or score exists and is 0)
        for audit_id, audit_data in audits.items():
            score = audit_data.get("score")
            
            # Skip passed or non-applicable audits
            if score is None or score >= 0.9:
                continue

            findings.append({
                'module': 'frontend',
                'severity': 'critical' if score < 0.5 else 'major',
                'category': 'lighthouse_audit',
                'title': f"Lighthouse: {audit_data.get('title')}",
                'description': audit_data.get('description', 'No description provided.'),
                'file': 'runtime_audit',
                'line': 1,
                'code_snippet': f"Lighthouse Score: {score}",
                'tool': 'lighthouse',
                'confidence': 1.0,
                'evidence': [
                    f"Category: {audit_id}",
                    f"Impact: {audit_data.get('displayValue', 'Significant')}"
                ],
                'suggested_fix': {
                    'code': '# Performance/A11y optimization required',
                    'explanation': f"Lighthouse recommends: {audit_data.get('title')}. See Lighthouse documentation for specific remediation steps.",
                    'safety_score': 1.0,
                    'automated': False
                },
                'references': ['Google Lighthouse', 'Web Vitals']
            })
            
        return findings
