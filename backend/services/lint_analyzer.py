"""Lint analyzer - detects code smells and style violations."""
from typing import List, Dict, Any

class LintAnalyzer:
    """Analyzes code quality and style."""
    
    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        findings = []
        for file_info in files:
            file_path = file_info.get('path', 'unknown')
            content = file_info.get('content', '')
            
            if not content:
                continue
            
            # Basic style & smell checks
            findings.extend(self._check_cognitive_complexity(file_path, content))
            
        return findings

    def _check_cognitive_complexity(self, file_path: str, content: str) -> List[Dict]:
        """Detect functions with high cognitive complexity."""
        findings = []
        lines = content.split('\n')
        
        # Simple heuristic: deep nesting and many conditionals
        complexity_keywords = ['if ', 'for ', 'while ', 'elif ', 'except ']
        current_func_lines = []
        in_func = False
        func_start_line = 0
        
        for line_num, line in enumerate(lines, 1):
            if line.strip().startswith(('def ', 'function ', 'async def ')):
                in_func = True
                func_start_line = line_num
                current_func_lines = []
            
            if in_func:
                current_func_lines.append(line)
                
            # End of function (simplistic indentation check)
            if in_func and line.strip() == '' and line_num < len(lines) and not lines[line_num].startswith(' '):
                # Analyze function complexity
                complexity = sum(1 for l in current_func_lines for kw in complexity_keywords if kw in l)
                if complexity > 7:
                    findings.append({
                        'module': 'code_quality',
                        'severity': 'major',
                        'category': 'cognitive_complexity',
                        'title': 'High Cognitive Complexity',
                        'description': f'This function has a complexity score of {complexity}. It may be difficult to maintain and test.',
                        'file': file_path,
                        'line': func_start_line,
                        'code_snippet': current_func_lines[0].strip(),
                        'tool': 'lint_analyzer',
                        'confidence': 0.8,
                        'evidence': [f'Counted {complexity} control flow structures'],
                        'suggested_fix': {
                            'code': '# Refactor into smaller helper functions',
                            'explanation': 'Break down complex logic into smaller, more manageable units.',
                            'safety_score': 0.95,
                            'automated': False
                        }
                    })
                in_func = False
        
        return findings

    def _check_naming_conventions(self, file_path: str, content: str) -> List[Dict]:
        """Detect naming convention violations (e.g., non-snake_case in Python)."""
        findings = []
        if not file_path.endswith('.py'):
            return findings
            
        import re
        # Detect non-snake_case (CamelCase or PascalCase) variables in Python
        pattern = r'\b([a-zA-Z]*[A-Z][a-zA-Z0-9]*)\s*='
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            matches = re.finditer(pattern, line)
            for match in matches:
                var_name = match.group(1)
                findings.append({
                    'module': 'code_quality',
                    'severity': 'minor',
                    'category': 'naming_convention',
                    'title': 'Non-Standard Naming Convention',
                    'description': f'Variable "{var_name}" uses CamelCase. Python variables should typically use snake_case.',
                    'file': file_path,
                    'line': line_num,
                    'code_snippet': line.strip(),
                    'tool': 'lint_analyzer',
                    'confidence': 0.9,
                    'evidence': ['Detected CamelCase in Python variable assignment'],
                    'suggested_fix': {
                        'code': f'# Rename to {re.sub(r"(?<!^)(?=[A-Z])", "_", var_name).lower()}',
                        'explanation': 'Follow PEP 8 naming conventions for better readability.',
                        'safety_score': 1.0,
                        'automated': True
                    }
                })
        return findings
