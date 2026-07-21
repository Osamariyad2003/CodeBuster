"""Dependency vulnerability analyzer.

Parses Python (requirements.txt) and Node (package.json) manifests found
among the scanned files and checks each pinned dependency against OSV.dev
(https://osv.dev) — a free, no-auth-required database that aggregates known
CVEs/GHSAs/PYSEC advisories across ecosystems.
"""
import json
import logging
import re
from typing import Any, Dict, List

import requests

logger = logging.getLogger(__name__)

OSV_QUERY_URL = "https://api.osv.dev/v1/query"
REQUEST_TIMEOUT = 4  # seconds per package lookup
MAX_PACKAGES_CHECKED = 60  # guardrail so one repo can't stall a scan

_REQ_LINE_RE = re.compile(r'^\s*([A-Za-z0-9_.\-]+)\s*==\s*([A-Za-z0-9_.\-]+)\s*(?:[;#].*)?$')

_SEVERITY_MAP = {'critical': 'critical', 'high': 'major', 'moderate': 'minor', 'medium': 'minor', 'low': 'info'}


class DependencyAnalyzer:
    """Scans dependency manifests for known-vulnerable pinned versions."""

    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        packages: List[Dict[str, Any]] = []
        for f in files:
            path = (f.get('path') or f.get('file') or '').replace('\\', '/')
            content = f.get('content') or ''
            name = path.rsplit('/', 1)[-1]
            if name == 'requirements.txt':
                packages += self._parse_requirements_txt(path, content)
            elif name == 'package.json':
                packages += self._parse_package_json(path, content)

        if not packages:
            return []

        truncated = len(packages) > MAX_PACKAGES_CHECKED
        packages = packages[:MAX_PACKAGES_CHECKED]

        findings = []
        for pkg in packages:
            for vuln in self._query_osv(pkg):
                findings.append(self._to_finding(pkg, vuln))

        if truncated:
            findings.append({
                'module': 'dependencies',
                'severity': 'info',
                'category': 'scan_truncated',
                'title': 'Dependency scan truncated',
                'description': (
                    f'Only the first {MAX_PACKAGES_CHECKED} pinned dependencies were checked '
                    'against the OSV vulnerability database to keep scan time bounded.'
                ),
                'file': 'dependencies',
                'line': None,
                'code_snippet': '',
                'confidence': 1.0,
                'tool': 'osv.dev',
            })

        return findings

    # ── manifest parsing ────────────────────────────────────────────────
    def _parse_requirements_txt(self, path: str, content: str) -> List[Dict[str, Any]]:
        out = []
        for i, line in enumerate(content.splitlines(), 1):
            stripped = line.strip()
            if not stripped or stripped.startswith('#') or stripped.startswith('-'):
                continue
            m = _REQ_LINE_RE.match(stripped)
            if not m:
                continue
            out.append({
                'name': m.group(1).lower(),
                'version': m.group(2),
                'ecosystem': 'PyPI',
                'file': path,
                'line': i,
            })
        return out

    def _parse_package_json(self, path: str, content: str) -> List[Dict[str, Any]]:
        out = []
        try:
            data = json.loads(content)
        except (ValueError, TypeError):
            return out
        for section in ('dependencies', 'devDependencies'):
            deps = data.get(section) or {}
            if not isinstance(deps, dict):
                continue
            for name, version in deps.items():
                clean = re.sub(r'^[\^~>=<\s]+', '', str(version)).strip()
                if not clean or not re.match(r'^\d', clean):
                    continue  # skip "latest", git/workspace refs, etc. — not resolvable to a version
                out.append({
                    'name': name,
                    'version': clean,
                    'ecosystem': 'npm',
                    'file': path,
                    'line': None,
                })
        return out

    # ── OSV lookup ───────────────────────────────────────────────────────
    def _query_osv(self, pkg: Dict[str, Any]) -> List[Dict[str, Any]]:
        try:
            resp = requests.post(
                OSV_QUERY_URL,
                json={
                    'package': {'name': pkg['name'], 'ecosystem': pkg['ecosystem']},
                    'version': pkg['version'],
                },
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code != 200:
                return []
            return resp.json().get('vulns') or []
        except requests.RequestException as e:
            logger.debug('OSV lookup failed for %s@%s: %s', pkg['name'], pkg['version'], e)
            return []

    def _to_finding(self, pkg: Dict[str, Any], vuln: Dict[str, Any]) -> Dict[str, Any]:
        vuln_id = vuln.get('id') or 'UNKNOWN'
        summary = vuln.get('summary') or (vuln.get('details') or '')[:200] or 'Known vulnerability in this dependency.'
        aliases = vuln.get('aliases') or []
        refs = [r.get('url') for r in (vuln.get('references') or []) if r.get('url')][:3]

        return {
            'module': 'dependencies',
            'severity': self._bucket_severity(vuln),
            'category': 'vulnerable_dependency',
            'title': f"{pkg['name']}@{pkg['version']}: {vuln_id}",
            'description': summary,
            'file': pkg['file'],
            'line': pkg.get('line'),
            'code_snippet': f"{pkg['name']}=={pkg['version']}",
            'confidence': 0.9,
            'tool': 'osv.dev',
            'evidence': [vuln_id] + aliases[:3],
            'references': refs,
            'suggested_fix': {
                'explanation': f"Upgrade {pkg['name']} past the version(s) affected by {vuln_id}. See references for the patched release.",
            },
        }

    @staticmethod
    def _bucket_severity(vuln: Dict[str, Any]) -> str:
        for s in vuln.get('severity') or []:
            score_str = s.get('score', '') or ''
            m = re.search(r'(\d+(?:\.\d+)?)', score_str)
            if m:
                val = float(m.group(1))
                if val >= 9.0:
                    return 'critical'
                if val >= 7.0:
                    return 'major'
                if val >= 4.0:
                    return 'minor'
                return 'info'
        db_sev = ((vuln.get('database_specific') or {}).get('severity') or '').lower()
        if db_sev in _SEVERITY_MAP:
            return _SEVERITY_MAP[db_sev]
        return 'major'  # known vuln with no parseable severity — treat as major, not silently dropped
