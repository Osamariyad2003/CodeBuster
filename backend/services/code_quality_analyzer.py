"""Code quality analyzer - detects code smells, style violations, and complexity issues."""
import re
from typing import List, Dict, Any

class CodeQualityAnalyzer:
    """Analyzes code for quality issues."""
    
    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyze files for code quality issues.
        
        Args:
            files: List of file dicts with 'path' and 'content' keys
            
        Returns:
            List of finding dicts
        """
        findings = []
        
        for file_info in files:
            file_path = file_info.get('path', file_info.get('filename', 'unknown'))
            content = file_info.get('content', '')
            
            if not content:
                continue
            
            # Check file length
            findings.extend(self._check_file_length(file_path, content))
            
            # Check for code smells
            findings.extend(self._check_code_smells(file_path, content))
            
            # Check for style issues
            findings.extend(self._check_style_issues(file_path, content))
            
            # Check for complexity
            findings.extend(self._check_complexity(file_path, content))
        
        return findings
    
    def _check_file_length(self, file_path: str, content: str) -> List[Dict]:
        """Check if file is too long."""
        findings = []
        lines = content.split('\n')
        line_count = len(lines)
        
        if line_count > 500:
            findings.append({
                'module': 'code_quality',
                'severity': 'major',
                'category': 'file_length',
                'title': 'File Too Long',
                'description': f'File has {line_count} lines. Consider splitting into smaller modules.',
                'file': file_path,
                'line': 1,
                'code_snippet': f'# File length: {line_count} lines',
                'tool': 'code_quality_analyzer',
                'confidence': 0.90,
                'evidence': [
                    f'File contains {line_count} lines',
                    'Recommended maximum: 300-500 lines'
                ],
                'suggested_fix': {
                    'code': '# Split file into smaller modules:\n# - Extract related functions to separate files\n# - Use classes to organize code',
                    'explanation': 'Split large files into smaller, more maintainable modules.',
                    'safety_score': 0.95,
                    'automated': False
                }
            })
        elif line_count > 300:
            findings.append({
                'module': 'code_quality',
                'severity': 'minor',
                'category': 'file_length',
                'title': 'File Getting Long',
                'description': f'File has {line_count} lines. Consider refactoring.',
                'file': file_path,
                'line': 1,
                'code_snippet': f'# File length: {line_count} lines',
                'tool': 'code_quality_analyzer',
                'confidence': 0.70,
                'evidence': [f'File contains {line_count} lines'],
                'suggested_fix': {
                    'code': '# Consider splitting into smaller modules',
                    'explanation': 'Smaller files are easier to maintain.',
                    'safety_score': 0.90,
                    'automated': False
                }
            })
        
        return findings
    
    def _check_code_smells(self, file_path: str, content: str) -> List[Dict]:
        """Check for code smells."""
        findings = []
        lines = content.split('\n')
        
        # Check for TODO/FIXME
        for line_num, line in enumerate(lines, 1):
            if re.search(r'\bTODO\b', line, re.IGNORECASE):
                findings.append({
                    'module': 'code_quality',
                    'severity': 'minor',
                    'category': 'todo',
                    'title': 'TODO Comment Found',
                    'description': 'TODO comment found. Please resolve before merging.',
                    'file': file_path,
                    'line': line_num,
                    'code_snippet': line.strip(),
                    'tool': 'code_quality_analyzer',
                    'confidence': 0.95,
                    'evidence': [f'TODO found at line {line_num}'],
                    'suggested_fix': {
                        'code': '# Remove TODO or implement the feature',
                        'explanation': 'Resolve TODO comments before merging.',
                        'safety_score': 1.0,
                        'automated': False
                    }
                })
            
            if re.search(r'\bFIXME\b', line, re.IGNORECASE):
                findings.append({
                    'module': 'code_quality',
                    'severity': 'medium',
                    'category': 'fixme',
                    'title': 'FIXME Comment Found',
                    'description': 'FIXME comment found. This indicates incomplete or broken code.',
                    'file': file_path,
                    'line': line_num,
                    'code_snippet': line.strip(),
                    'tool': 'code_quality_analyzer',
                    'confidence': 0.95,
                    'evidence': [f'FIXME found at line {line_num}'],
                    'suggested_fix': {
                        'code': '# Fix the issue or remove FIXME',
                        'explanation': 'FIXME comments should be resolved before merging.',
                        'safety_score': 1.0,
                        'automated': False
                    }
                })
        
        # Check for print statements (Python)
        if file_path.endswith('.py'):
            for line_num, line in enumerate(lines, 1):
                if re.search(r'\bprint\s*\(', line) and not line.strip().startswith('#'):
                    findings.append({
                        'module': 'code_quality',
                        'severity': 'minor',
                        'category': 'logging',
                        'title': 'Console Logging Detected',
                        'description': 'print() statement found. Use a logger for production code.',
                        'file': file_path,
                        'line': line_num,
                        'code_snippet': line.strip(),
                        'tool': 'code_quality_analyzer',
                        'confidence': 0.90,
                        'evidence': [f'print() statement at line {line_num}'],
                        'suggested_fix': {
                            'code': 'import logging\nlogger = logging.getLogger(__name__)\nlogger.info("message")',
                            'explanation': 'Use proper logging instead of print statements.',
                            'safety_score': 0.95,
                            'automated': False
                        }
                    })
        
        return findings
    
    def _check_style_issues(self, file_path: str, content: str) -> List[Dict]:
        """Check for style violations: long lines, trailing whitespace, mixed indentation, console.log."""
        findings = []
        lines = content.split('\n')
        is_py = file_path.endswith('.py')
        is_js = file_path.endswith(('.js', '.jsx', '.ts', '.tsx'))

        has_tabs = False
        has_spaces = False

        for line_num, line in enumerate(lines, 1):
            stripped = line.rstrip('\n')

            # Long lines (ignore URLs and import/require lines)
            if len(stripped) > 120 and 'http' not in stripped and not re.search(r'\b(import|require)\b', stripped):
                findings.append({
                    'module': 'code_quality',
                    'severity': 'minor',
                    'category': 'style',
                    'title': 'Line Too Long',
                    'description': f'Line {line_num} is {len(stripped)} characters (limit: 120).',
                    'file': file_path,
                    'line': line_num,
                    'code_snippet': stripped[:120] + '…',
                    'tool': 'code_quality_analyzer',
                    'confidence': 0.95,
                    'evidence': [f'{len(stripped)} chars on line {line_num}'],
                    'suggested_fix': {
                        'code': '# Wrap long expressions across multiple lines',
                        'explanation': 'Keep lines under 120 characters for readability.',
                        'safety_score': 1.0,
                        'automated': False,
                    },
                })

            # Trailing whitespace
            if stripped != stripped.rstrip():
                findings.append({
                    'module': 'code_quality',
                    'severity': 'minor',
                    'category': 'style',
                    'title': 'Trailing Whitespace',
                    'description': f'Line {line_num} has trailing whitespace.',
                    'file': file_path,
                    'line': line_num,
                    'code_snippet': repr(stripped),
                    'tool': 'code_quality_analyzer',
                    'confidence': 1.0,
                    'evidence': [f'Trailing spaces/tabs at line {line_num}'],
                    'suggested_fix': {
                        'code': '# Configure your editor to strip trailing whitespace on save',
                        'explanation': 'Trailing whitespace causes noisy diffs.',
                        'safety_score': 1.0,
                        'automated': True,
                    },
                })

            # Mixed indentation detection (collect, report once at end)
            if stripped and stripped[0] == '\t':
                has_tabs = True
            elif stripped and stripped[0] == ' ':
                has_spaces = True

            # console.log / console.error in JS/TS
            if is_js and re.search(r'\bconsole\.(log|error|warn|debug)\s*\(', line) and not line.strip().startswith('//'):
                findings.append({
                    'module': 'code_quality',
                    'severity': 'minor',
                    'category': 'logging',
                    'title': 'Console Statement Left In Code',
                    'description': f'console.* call found at line {line_num}. Remove before shipping to production.',
                    'file': file_path,
                    'line': line_num,
                    'code_snippet': line.strip(),
                    'tool': 'code_quality_analyzer',
                    'confidence': 0.90,
                    'evidence': [f'console.* at line {line_num}'],
                    'suggested_fix': {
                        'code': '// Use a structured logger (e.g. pino, winston) instead',
                        'explanation': 'console.* leaks internals and hurts performance in production.',
                        'safety_score': 0.95,
                        'automated': False,
                    },
                })

        if has_tabs and has_spaces:
            findings.append({
                'module': 'code_quality',
                'severity': 'minor',
                'category': 'style',
                'title': 'Mixed Indentation',
                'description': 'File mixes tabs and spaces for indentation.',
                'file': file_path,
                'line': 1,
                'code_snippet': '',
                'tool': 'code_quality_analyzer',
                'confidence': 0.95,
                'evidence': ['Both tab and space indentation detected'],
                'suggested_fix': {
                    'code': '# Standardise on spaces (PEP 8 for Python, prettier for JS/TS)',
                    'explanation': 'Mixed indentation causes syntax errors in Python and confuses editors.',
                    'safety_score': 1.0,
                    'automated': True,
                },
            })

        return findings

    def _check_complexity(self, file_path: str, content: str) -> List[Dict]:
        """Per-function cyclomatic complexity using control-flow keyword counting."""
        findings = []
        lines = content.split('\n')
        is_py = file_path.endswith('.py')
        is_js = file_path.endswith(('.js', '.jsx', '.ts', '.tsx'))

        if not (is_py or is_js):
            return findings

        # Detect function start lines
        if is_py:
            func_pattern = re.compile(r'^\s*(async\s+)?def\s+(\w+)\s*\(')
        else:
            func_pattern = re.compile(
                r'^\s*(async\s+)?(function\s+(\w+)|(\w+)\s*[:=]\s*(async\s+)?(\([^)]*\)|[a-zA-Z_]\w*)\s*=>)'
            )

        branch_keywords = re.compile(
            r'\b(if|else\s+if|elif|for|while|case|catch|&&|\|\||\?)\b'
        )

        # Collect function spans: (name, start_line)
        func_starts = []
        for i, line in enumerate(lines):
            m = func_pattern.match(line)
            if m:
                name = m.group(2) if is_py else (m.group(3) or m.group(4) or '<anonymous>')
                func_starts.append((name, i))

        for idx, (name, start) in enumerate(func_starts):
            end = func_starts[idx + 1][1] if idx + 1 < len(func_starts) else len(lines)
            # For Python use indentation to bound the function body
            if is_py:
                base_indent = len(lines[start]) - len(lines[start].lstrip())
                body_end = start + 1
                while body_end < len(lines):
                    l = lines[body_end]
                    if l.strip() and (len(l) - len(l.lstrip())) <= base_indent:
                        break
                    body_end += 1
                end = body_end

            func_lines = lines[start:end]
            # Cyclomatic complexity = 1 + number of branches
            complexity = 1 + sum(
                len(branch_keywords.findall(l))
                for l in func_lines
                if not l.strip().startswith(('#', '//'))
            )

            if complexity >= 15:
                severity = 'major'
            elif complexity >= 10:
                severity = 'minor'
            else:
                continue

            findings.append({
                'module': 'code_quality',
                'severity': severity,
                'category': 'complexity',
                'title': f'High Cyclomatic Complexity in `{name}`',
                'description': (
                    f'`{name}` has a cyclomatic complexity of {complexity}. '
                    f'Functions above 10 are hard to test; above 15 are hard to maintain.'
                ),
                'file': file_path,
                'line': start + 1,
                'code_snippet': lines[start].strip(),
                'tool': 'code_quality_analyzer',
                'confidence': 0.80,
                'evidence': [f'Cyclomatic complexity: {complexity}', f'Function starts at line {start + 1}'],
                'suggested_fix': {
                    'code': '# Extract branches into well-named helper functions\n# Use early returns to flatten nesting',
                    'explanation': 'Lower complexity makes code easier to test and reason about.',
                    'safety_score': 0.90,
                    'automated': False,
                },
            })

        return findings

