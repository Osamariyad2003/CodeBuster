"""TruffleHog scanner service - detects secrets using TruffleHog V3."""
import subprocess
import json
import tempfile
import os
import shutil
from typing import List, Dict, Any
import structlog

logger = structlog.get_logger()

class TruffleHogScanner:
    """Scanner that uses TruffleHog V3 to detect secrets in files."""

    def __init__(self, binary_path: str = "trufflehog"):
        self.binary_path = binary_path

    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyze the provided files for secrets using TruffleHog.
        
        Args:
            files: List of dicts with 'path' and 'content' keys.
            
        Returns:
            List of findings in standard CodeBuster format.
        """
        if not files:
            return []

        findings = []
        temp_dir = tempfile.mkdtemp(prefix="codebuster_trufflehog_")
        
        try:
            # 1. Write files to temporary directory
            for file_info in files:
                file_path = file_info.get('path', 'unknown')
                content = file_info.get('content', '')
                
                # Create subdirectories if needed
                full_path = os.path.join(temp_dir, file_path)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(content)

            # 2. Run TruffleHog V3 (filesystem mode)
            # --json: Output as NDJSON (Newline Delimited JSON)
            # --no-update: Don't check for updates in CI/production
            cmd = [
                self.binary_path,
                "filesystem",
                temp_dir,
                "--json",
                "--no-update"
            ]
            
            logger.info("running_trufflehog", cmd=" ".join(cmd))
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False # TruffleHog exits with non-zero if findings found
            )

            # 3. Parse findings (NDJSON)
            if result.stdout:
                for line in result.stdout.strip().split("\n"):
                    if not line:
                        continue
                    try:
                        raw_finding = json.loads(line)
                        standard_finding = self._map_to_standard_format(raw_finding, temp_dir)
                        if standard_finding:
                            findings.append(standard_finding)
                    except json.JSONDecodeError as e:
                        logger.error("trufflehog_json_parse_error", error=str(e), line=line[:100])

            if result.stderr and not result.stdout:
                logger.warning("trufflehog_stderr", stderr=result.stderr)

        except Exception as e:
            logger.error("trufflehog_execution_failed", error=str(e))
        finally:
            # Clean up
            shutil.rmtree(temp_dir, ignore_errors=True)

        return findings

    def _map_to_standard_format(self, raw: Dict[str, Any], base_path: str) -> Dict[str, Any]:
        """Maps TruffleHog JSON output to CodeBuster Finding format."""
        source_id = raw.get("SourceID", 0)
        source_metadata = raw.get("SourceMetadata", {}).get("Data", {}).get("Filesystem", {})
        
        # TruffleHog V3 output structure varies, but generally:
        # SourceMetadata.Data.Filesystem.file contains the path
        # SourceMetadata.Data.Filesystem.line contains the line number
        file_path = source_metadata.get("file", "unknown")
        
        # Strip the base_path to get relative path
        if file_path.startswith(base_path):
            file_path = os.path.relpath(file_path, base_path)

        # Detector information
        detector_name = raw.get("DetectorName", "Unknown detector")
        verified = raw.get("Verified", False)
        
        return {
            'module': 'security',
            'severity': 'critical' if verified else 'major',
            'category': 'secret_leak',
            'title': f'Secret Detected: {detector_name}',
            'description': f'TruffleHog detected a potential secret: {detector_name}. ' + 
                          ('THIS SECRET HAS BEEN VERIFIED AS ACTIVE.' if verified else 'Verification skipped or failed.'),
            'file': file_path,
            'line': source_metadata.get("line", 1),
            'code_snippet': raw.get("Raw", "Secret redacted by scanner"),
            'tool': 'trufflehog',
            'confidence': 1.0 if verified else 0.8,
            'evidence': [
                f"Detector: {detector_name}",
                f"Verified: {verified}"
            ],
            'metadata': {
                'raw_detector': raw.get("DetectorType"),
                'verified': verified
            },
            'suggested_fix': {
                'code': "# Revoke and rotate this secret immediately",
                'explanation': 'Hardcoded secrets are visible to anyone with access to the codebase. Revoke the secret and use a secrets manager.',
                'safety_score': 1.0,
                'automated': False
            },
            'references': ['CWE-798', 'OWASP-A07:2021']
        }
