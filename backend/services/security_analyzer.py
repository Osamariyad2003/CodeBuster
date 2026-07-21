"""Security analyzer - detects secrets, vulnerabilities, and security issues."""
import re
import os
from typing import List, Dict, Any

class SecurityAnalyzer:
    """Analyzes code for security vulnerabilities."""
    
    # Common secret patterns (Expanded)
    SECRET_PATTERNS = [
        (r'api[_-]?key\s*[:=]\s*["\']([^"\']+)["\']', 'API Key'),
        (r'secret[_-]?key\s*[:=]\s*["\']([^"\']+)["\']', 'Secret Key'),
        (r'password\s*[:=]\s*["\']([^"\']+)["\']', 'Password'),
        (r'token\s*[:=]\s*["\']([^"\']+)["\']', 'Token'),
        (r'sk_live_[a-zA-Z0-9]{24,}', 'Stripe Live Key'),
        (r'sk_test_[a-zA-Z0-9]{24,}', 'Stripe Test Key'),
        (r'AKIA[0-9A-Z]{16}', 'AWS Access Key'),
        (r'ghp_[a-zA-Z0-9]{36}', 'GitHub Personal Access Token'),
        (r'xox[baprs]-[0-9a-zA-Z-]{10,48}', 'Slack Token'),
        (r'AIza[0-9A-Za-z-_]{35}', 'Google API Key'),
        (r'sq0csp-[0-9A-Za-z-_]{43}', 'Square OAuth Secret'),
        (r'access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}', 'PayPal Braintree Access Token'),
        (r'AC[a-f0-9]{32}', 'Twilio Account SID'),
        (r'SK[a-f0-9]{32}', 'Twilio API Key'),
    ]
    
    # SQL injection patterns
    SQL_INJECTION_PATTERNS = [
        (r'f["\'].*SELECT.*\{.*\}', 'SQL Injection - f-string in SQL'),
        (r'\+.*SELECT.*\+', 'SQL Injection - string concatenation'),
        (r'%s.*\{.*\}', 'SQL Injection - mixed parameterization'),
        (r'execute\(["\'].*%.*["\']\s*%', 'SQL Injection - string formatting in execute'),
    ]
    
    # XSS patterns
    XSS_PATTERNS = [
        (r'innerHTML\s*=\s*[^;]+', 'XSS - innerHTML assignment'),
        (r'dangerouslySetInnerHTML', 'XSS - React dangerouslySetInnerHTML'),
        (r'document\.write\(', 'XSS - document.write usage'),
    ]
    
    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyze files for security issues.
        """
        findings = []
        
        for file_info in files:
            file_path = file_info.get('path', file_info.get('filename', 'unknown'))
            content = file_info.get('content', '')
            
            if not content:
                continue
            
            # Check for secrets
            findings.extend(self._check_secrets(file_path, content))
            
            # Check for SQL injection
            findings.extend(self._check_sql_injection(file_path, content))
            
            # Check for XSS
            if self._is_web_file(file_path):
                findings.extend(self._check_xss(file_path, content))
            
            # entropy-based check
            findings.extend(self._check_entropy(file_path, content))
        
        return findings

    def _calculate_entropy(self, data: str) -> float:
        """Calculate Shannon entropy of a string."""
        if not data:
            return 0
        import math
        entropy = 0
        for x in range(256):
            p_x = float(data.count(chr(x))) / len(data)
            if p_x > 0:
                entropy += - p_x * math.log(p_x, 2)
        return entropy

    def _check_entropy(self, file_path: str, content: str) -> List[Dict]:
        """Detect high-entropy strings that might be secrets."""
        findings = []
        # Match potential random strings in quotes
        pattern = r'["\']([a-zA-Z0-9+/=]{16,})["\']'
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            matches = re.finditer(pattern, line)
            for match in matches:
                candidate = match.group(1)
                entropy = self._calculate_entropy(candidate)
                
                # Higher entropy threshold for longer strings
                if entropy > 3.8 and len(candidate) > 20:
                    if self._is_real_secret(candidate):
                        # Avoid duplicates from regex patterns
                        if any(re.search(p[0], line) for p in self.SECRET_PATTERNS):
                            continue
                            
                        findings.append({
                            'module': 'security',
                            'severity': 'major',
                            'category': 'high_entropy_secret',
                            'title': 'High Entropy String Detected',
                            'description': 'A high-entropy string was found. This frequently indicates a hardcoded secret or token.',
                            'file': file_path,
                            'line': line_num,
                            'code_snippet': line.strip(),
                            'tool': 'security_analyzer',
                            'confidence': 0.7,
                            'evidence': [f'Shannon entropy: {entropy:.2f}', 'String length: ' + str(len(candidate))],
                            'suggested_fix': {
                                'code': "# Move to environment variable",
                                'explanation': 'Ensure this string is not a sensitive credential.',
                                'safety_score': 0.9,
                                'automated': False
                            }
                        })
        return findings
    
    def _check_secrets(self, file_path: str, content: str) -> List[Dict]:
        """Check for hardcoded secrets."""
        findings = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            # Skip comments and test files
            if line.strip().startswith('#') or line.strip().startswith('//'):
                continue
            if '/test/' in file_path.lower() or '/tests/' in file_path.lower():
                continue
            
            for pattern, secret_type in self.SECRET_PATTERNS:
                matches = re.finditer(pattern, line, re.IGNORECASE)
                for match in matches:
                    # Check if it's a real secret (not a placeholder)
                    secret_value = match.group(1) if match.groups() else match.group(0)
                    if self._is_real_secret(secret_value):
                        findings.append({
                            'module': 'security',
                            'severity': 'critical',
                            'category': 'secret_leak',
                            'title': f'Hardcoded {secret_type}',
                            'description': f'Hardcoded {secret_type} detected in code. This is a critical security vulnerability.',
                            'file': file_path,
                            'line': line_num,
                            'code_snippet': line.strip(),
                            'tool': 'security_analyzer',
                            'confidence': 0.95,
                            'evidence': [
                                f'Security analyzer detected {secret_type} pattern',
                                f'Value found at line {line_num}'
                            ],
                            'suggested_fix': {
                                'code': f"# Replace with: os.getenv('{secret_type.upper().replace(' ', '_')}')",
                                'explanation': f'Move {secret_type} to environment variable for security.',
                                'safety_score': 1.0,
                                'automated': False
                            },
                            'references': ['CWE-798', 'OWASP-A07:2021']
                        })
        
        return findings
    
    def _check_sql_injection(self, file_path: str, content: str) -> List[Dict]:
        """Check for SQL injection vulnerabilities."""
        findings = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            for pattern, description in self.SQL_INJECTION_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    findings.append({
                        'module': 'security',
                        'severity': 'critical',
                        'category': 'sql_injection',
                        'title': 'SQL Injection Vulnerability',
                        'description': f'{description}. User input is directly concatenated into SQL query without parameterization.',
                        'file': file_path,
                        'line': line_num,
                        'code_snippet': line.strip(),
                        'tool': 'security_analyzer',
                        'confidence': 0.85,
                        'evidence': [
                            'Security analyzer detected SQL injection pattern',
                            f'Potentially unsafe string operation at line {line_num}'
                        ],
                        'suggested_fix': {
                            'code': '# Use parameterized queries',
                            'explanation': 'Use parameterized queries to prevent SQL injection.',
                            'safety_score': 0.98,
                            'automated': False
                        },
                        'references': ['CWE-89', 'OWASP-A03:2021']
                    })
        
        return findings
    
    def _check_xss(self, file_path: str, content: str) -> List[Dict]:
        """Check for XSS vulnerabilities."""
        findings = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            for pattern, description in self.XSS_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    findings.append({
                        'module': 'security',
                        'severity': 'major',
                        'category': 'xss',
                        'title': 'XSS Vulnerability',
                        'description': f'{description}. This can lead to cross-site scripting attacks.',
                        'file': file_path,
                        'line': line_num,
                        'code_snippet': line.strip(),
                        'tool': 'security_analyzer',
                        'confidence': 0.80,
                        'evidence': [
                            'Security analyzer detected XSS pattern',
                            f'Unsafe assignment at line {line_num}'
                        ],
                        'suggested_fix': {
                            'code': '# Use safe alternatives like textContent',
                            'explanation': 'Avoid direct HTML injection; use DOM sanitization.',
                            'safety_score': 0.95,
                            'automated': False
                        },
                        'references': ['CWE-79', 'OWASP-A03:2021']
                    })
        
        return findings
    
    def _is_web_file(self, file_path: str) -> bool:
        """Check if file is a web file (JS/TS/JSX/TSX)."""
        web_extensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.htm']
        return any(file_path.lower().endswith(ext) for ext in web_extensions)
    
    def _is_real_secret(self, value: str) -> bool:
        """Check if value looks like a real secret (not placeholder)."""
        # Placeholder patterns
        placeholders = [
            'your_', 'example_', 'placeholder', 'xxx', 'test_', 'demo_',
            'changeme', 'replace', 'secret_key', 'api_key'
        ]
        
        value_lower = value.lower()
        if any(placeholder in value_lower for placeholder in placeholders):
            return False
        
        # Real secrets are usually longer
        if len(value) < 10:
            return False
        
        return True
    
    def _is_web_file(self, file_path: str) -> bool:
        """Check if file is a web file (JS/TS/JSX/TSX)."""
        web_extensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.htm']
        return any(file_path.lower().endswith(ext) for ext in web_extensions)
    
    def _is_real_secret(self, value: str) -> bool:
        """Check if value looks like a real secret (not placeholder)."""
        # Placeholder patterns
        placeholders = [
            'your_', 'example_', 'placeholder', 'xxx', 'test_', 'demo_',
            'changeme', 'replace', 'secret_key', 'api_key'
        ]
        
        value_lower = value.lower()
        if any(placeholder in value_lower for placeholder in placeholders):
            return False
        
        # Real secrets are usually longer
        if len(value) < 10:
            return False
        
        return True

