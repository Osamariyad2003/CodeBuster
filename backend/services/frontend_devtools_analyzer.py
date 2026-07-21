"""Frontend DevTools Analyzer - scans for Web Vitals, Network, and Memory issues inspired by Chrome DevTools."""
import re
from typing import List, Dict, Any
import structlog

logger = structlog.get_logger()

class FrontendDevToolsAnalyzer:
    """
    Analyzes frontend code for performance, network, and memory issues
    mirroring Chrome DevTools audits (Lighthouse, Performance Tab).
    """

    # Performance & Layout Thrashing Patterns
    PERF_PATTERNS = [
        (r'\.offsetHeight|\.offsetWidth|\.getComputedStyle', 'major', 'layout_thrashing', 'Potential Layout Thrashing',
         'Repeated access to layout-triggering properties can cause "forced synchronous layouts," significantly impacting frame rate.'),
        (r'document\.querySelectorAll\([\'"]\*[\'"]\)', 'minor', 'dom_size', 'Overly Broad DOM Selection',
         'Selecting all elements is expensive. Use specific selectors to reduce work in the browser render tree.'),
        (r'new\s+Array\(\d{6,}\)', 'medium', 'memory_bottleneck', 'Potential Memory Hotspot',
         'Allocating very large arrays in the main thread can cause garbage collection spikes and UI jank.'),
    ]

    # Network & Resource Patterns
    NETWORK_PATTERNS = [
        (r'<script(?!.*?async)(?!.*?defer)[^>]*src=', 'major', 'network_blocking', 'Eliminate Render-Blocking Resources',
         'Scripts without async or defer block the parser, delaying first paint. Use "defer" for non-critical scripts.'),
        (r'<img(?!.*?loading=[\'"]lazy[\'"])[^>]*>', 'minor', 'network_payload', 'Missing Lazy Loading',
         'Offscreen images should be lazy-loaded to save bandwidth and improve initial load time (LCP).'),
        (r'http://', 'medium', 'security_network', 'Insecure Resource Loading',
         'Loading resources over HTTP in a modern app is a security risk and prevents the use of HTTP/2/3 features available in DevTools.'),
    ]

    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run frontend performance analysis inspired by Chrome DevTools."""
        findings = []
        for file_info in files:
            path = file_info.get('path', 'unknown')
            content = file_info.get('content', '')
            
            if not content:
                continue

            # Only analyze frontend files
            if any(path.lower().endswith(ext) for ext in ['.js', '.ts', '.jsx', '.tsx', '.html', '.vue']):
                findings.extend(self._scan_patterns(path, content, self.PERF_PATTERNS, "performance"))
                findings.extend(self._scan_patterns(path, content, self.NETWORK_PATTERNS, "network"))
                
        return findings

    def _scan_patterns(self, file_path: str, content: str, patterns: List[tuple], category: str) -> List[Dict]:
        findings = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            for pattern, severity, sub_cat, title, desc in patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    findings.append({
                        'module': 'frontend',
                        'severity': severity,
                        'category': sub_cat,
                        'title': title,
                        'description': desc,
                        'file': file_path,
                        'line': line_num,
                        'code_snippet': line.strip(),
                        'tool': 'chrome_devtools_analyzer',
                        'confidence': 0.85,
                        'evidence': [
                            f"DevTools Category: {category.capitalize()}",
                            f"Insight: {title}"
                        ],
                        'suggested_fix': {
                            'code': '# Optimize for Web Vitals & Chrome DevTools insights',
                            'explanation': 'Follow Chrome DevTools recommendations to improve performance, network efficiency, and memory usage.',
                            'safety_score': 0.9,
                            'automated': False
                        },
                        'references': ['Web Vitals (LCP, FID, CLS)', 'Chrome DevTools Audits']
                    })
        return findings
