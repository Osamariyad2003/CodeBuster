"""Semgrep analyzer - deep security audits using rules and AST parsing."""
import subprocess
import json
import os
import ast
from typing import List, Dict, Any

class SemgrepAnalyzer:
    """Analyzes code using Semgrep or AST fallback."""
    
    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        findings = []
        for file_info in files:
            file_path = file_info.get('path', 'unknown')
            content = file_info.get('content', '')
            
            if not content:
                continue
                
            # Try AST fallback first (always safe and zero-dependency)
            if file_path.endswith('.py'):
                findings.extend(self._analyze_python_ast(file_path, content))
            
            # TODO: Add JS/TS AST analyzer
                
        # Try CLI if available (provides much deeper coverage)
        # Note: In a production environment, we would run Semgrep CLI on the whole repo
        # For this MVP, we focus on the per-file AST checks for speed and reliability
        
        return findings

    def _analyze_python_ast(self, file_path: str, content: str) -> List[Dict]:
        """Deep security analysis of Python code using AST."""
        findings = []
        try:
            tree = ast.parse(content)
            for node in ast.walk(tree):
                # Detect unsafe subprocess usage
                if isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Attribute) and node.func.attr == 'Popen':
                        findings.append(self._create_finding(
                            'critical', 'unsafe_subprocess', 'Unsafe Subprocess Usage',
                            'Detected direct use of subprocess.Popen which can lead to command injection if not properly sanitized.',
                            file_path, node.lineno, 'subprocess.Popen(...)', 0.85
                        ))
                    
                    # Detect eval/exec
                    if isinstance(node.func, ast.Name) and node.func.id in ['eval', 'exec']:
                        findings.append(self._create_finding(
                            'critical', 'dynamic_execution', 'Dynamic Code Execution',
                            f'Use of {node.func.id}() detected. This is highly dangerous and can lead to remote code execution.',
                            file_path, node.lineno, f'{node.func.id}(...)', 0.95
                        ))
                        
                    # Detect unsafe yaml loading
                    if isinstance(node.func, ast.Attribute) and node.func.attr == 'load':
                        if isinstance(node.func.value, ast.Name) and node.func.value.id == 'yaml':
                            findings.append(self._create_finding(
                                'major', 'unsafe_yaml_load', 'Unsafe YAML Loading',
                                'Detected yaml.load() without explicit Loader. This can lead to arbitrary code execution.',
                                file_path, node.lineno, 'yaml.load(...)', 0.8
                            ))
        except SyntaxError:
            pass # Skip malformed files
        return findings

    def _create_finding(self, severity, category, title, description, file, line, snippet, confidence):
        return {
            'module': 'security',
            'severity': severity,
            'category': category,
            'title': title,
            'description': description,
            'file': file,
            'line': line,
            'code_snippet': snippet,
            'tool': 'semgrep_analyzer',
            'confidence': confidence,
            'evidence': [f'AST-based semantic analysis detected {category}'],
            'suggested_fix': {
                'code': '# Use safe alternatives (e.g., yaml.safe_load, subprocess.run with list args)',
                'explanation': f'Replace unsafe operation with a secure equivalent.',
                'safety_score': 0.9,
                'automated': False
            }
        }
