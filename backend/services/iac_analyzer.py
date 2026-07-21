"""IaC Analyzer - scans Terraform and Kubernetes files for security risks."""
from typing import List, Dict, Any
import re

class IaCAnalyzer:
    """Detects security and configuration issues in IaC files."""
    
    TF_PATTERNS = [
        (r'acl\s*=\s*"public-read"', 'major', 'public_s3_bucket', 'Public S3 Bucket ACL', 
         'Detected public-read ACL on an S3 bucket. This exposes data to the public internet.'),
        (r'cidr_blocks\s*=\s*\[\s*"0\.0\.0\.0/0"\s*\]', 'major', 'open_ingress', 'Broad Ingress Rule',
         'Detected 0.0.0.0/0 in ingress rules. This may expose internal services to the public.'),
        (r'encrypted\s*=\s*false', 'minor', 'unencrypted_ebs', 'Unencrypted EBS Volume',
         'Detected unencrypted EBS volume. Better practice is to enable encryption.'),
        # Checkov-inspired patterns
        (r'variable\s+.*{\s*default\s*=\s*".*"', 'minor', 'hardcoded_default', 'Hardcoded Variable Default',
         'Hardcoding defaults for variables can lead to configuration drifts across environments.')
    ]
    
    K8S_PATTERNS = [
        (r'privileged:\s*true', 'critical', 'privileged_container', 'Privileged Container',
         'Container is running in privileged mode. This could allow for container escape.'),
        (r'runAsUser:\s*0', 'major', 'root_user', 'Running as Root',
         'Container is explicitly configured to run as root user.'),
        (r'allowPrivilegeEscalation:\s*true', 'major', 'privilege_escalation', 'Privilege Escalation Allowed',
         'Allowing privilege escalation can be used by an attacker to gain more control.'),
        # Checkov-inspired patterns
        (r'readOnlyRootFilesystem:\s*false', 'medium', 'writable_root_fs', 'Writable Root Filesystem',
         'Containers should run with a read-only root filesystem to prevent persistent changes by an attacker.')
    ]

    DOCKER_PATTERNS = [
        # Hadolint-inspired patterns
        (r'FROM\s+.*:latest', 'major', 'docker_latest_tag', 'Using :latest Tag',
         'Using the :latest tag for a base image can cause non-deterministic builds.'),
        (r'RUN\s+apt-get\s+install\s+(?!-y)', 'medium', 'docker_apt_no_y', 'Apt Install without -y',
         'Always use -y with apt-get install to ensure non-interactive builds.'),
        (r'USER\s+root', 'major', 'docker_root_user', 'Running as Root in Docker',
         'Avoid running containers as root to minimize the impact of potential vulnerabilities.'),
        (r'MAINTAINER\s+', 'info', 'docker_maintainer_deprecated', 'Deprecated MAINTAINER Instruction',
         'The MAINTAINER instruction is deprecated. Use LABEL instead.')
    ]

    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run IaC analysis."""
        findings = []
        for file in files:
            path = file.get('path', '')
            content = file.get('content', '')
            
            if path.endswith(('.tf', '.tfvars')):
                findings.extend(self._scan_patterns(path, content, self.TF_PATTERNS, 'checkov_terraform'))
            elif path.endswith(('.yaml', '.yml')) and self._is_k8s_manifest(content):
                findings.extend(self._scan_patterns(path, content, self.K8S_PATTERNS, 'checkov_kubernetes'))
            elif path.lower().endswith('dockerfile') or '/dockerfile' in path.lower():
                findings.extend(self._scan_patterns(path, content, self.DOCKER_PATTERNS, 'hadolint'))
                
        return findings

    def _is_k8s_manifest(self, content: str) -> bool:
        """Simple heuristic to detect K8s manifests."""
        return 'apiVersion:' in content and 'kind:' in content

    def _scan_patterns(self, file_path: str, content: str, patterns: List, tool: str) -> List[Dict]:
        """Generic pattern scanner for IaC."""
        findings = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            for pattern, severity, category, title, desc in patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    findings.append({
                        'module': 'iac',
                        'severity': severity,
                        'category': category,
                        'title': f"{tool.capitalize()}: {title}",
                        'description': desc,
                        'file': file_path,
                        'line': line_num,
                        'code_snippet': line.strip(),
                        'tool': tool,
                        'confidence': 0.8,
                        'evidence': [f"Matched pattern: {pattern}"],
                        'suggested_fix': {
                            'code': "# Secure this configuration",
                            'explanation': f'Update the configuration to adhere to {tool} best practices.',
                            'safety_score': 0.9,
                            'automated': False
                        },
                        'references': ['Checkov Policies' if 'checkov' in tool else 'Hadolint Rules']
                    })
        return findings
