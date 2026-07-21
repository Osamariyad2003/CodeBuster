"""Accessibility Analyzer - scans HTML and JSX for A11y violations."""
from typing import List, Dict, Any
import re

class AccessibilityAnalyzer:
    """Detects accessibility issues in HTML and JSX/TSX."""
    
    A11Y_CHECKS = [
        (r'<img(?!.*?alt=)[^>]*>', 'major', 'missing_alt_text', 'Missing Alt Text',
         'Image elements should have an alt attribute for screen readers.'),
        (r'<(button|a)(?!.*?aria-label=)(?!.*?>.*?</\1)[^>]*>', 'major', 'missing_aria_label', 'Missing ARIA Label',
         'Interactive elements with no text content must have an aria-label.'),
        (r'<(h[1-6])(?!.*?id=)[^>]*>', 'info', 'missing_heading_id', 'Headings should have IDs',
         'Adding IDs to headings allows for easier navigation via anchor links.'),
        (r'onclick=', 'medium', 'non_semantic_button', 'Non-semantic Interactive Element',
         'Using onclick on non-interactive elements (like div or span) can make them inaccessible to keyboard users.'),
    ]

    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run accessibility analysis."""
        findings = []
        for file in files:
            path = file.get('path', '')
            content = file.get('content', '')
            
            if path.endswith(('.html', '.jsx', '.tsx', '.vue')):
                findings.extend(self._scan_a11y(path, content))
                
        return findings

    def _scan_a11y(self, file_path: str, content: str) -> List[Dict]:
        """Scan for accessibility patterns."""
        findings = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            for pattern, severity, category, title, desc in self.A11Y_CHECKS:
                # Basic regex match - might have false positives but good for static MVP
                if re.search(pattern, line, re.IGNORECASE):
                    findings.append({
                        'module': 'accessibility',
                        'severity': severity,
                        'category': category,
                        'title': title,
                        'description': desc,
                        'file': file_path,
                        'line': line_num,
                        'code_snippet': line.strip(),
                        'tool': 'a11y_analyzer',
                        'confidence': 0.75,
                        'evidence': [f"Matched A11y rule: {title}"],
                        'suggested_fix': {
                            'code': self._build_suggested_code(line, category),
                            'explanation': 'Add the missing attribute to improve screen reader support.',
                            'safety_score': 0.8,
                            'automated': False
                        }
                    })
        return findings

    def _build_suggested_code(self, line: str, category: str) -> str:
        """Safely build a suggested code snippet."""
        clean = line.strip()
        tag_name = "element"
        
        # Try to find a tag name if the line contains <
        if '<' in clean:
            try:
                parts = clean.split('<', 1)[1].split(None, 1)
                if parts:
                    tag_name = parts[0].strip('>').strip()
            except Exception:
                pass
        
        if category == 'missing_alt_text':
            return f'<{tag_name} alt="..." ... />'
        if category == 'missing_aria_label':
            return f'<{tag_name} aria-label="..." ... />'
        if category == 'non_semantic_button':
            return '<button onclick="...">...</button>'
        
        return f'<{tag_name} ... />'
