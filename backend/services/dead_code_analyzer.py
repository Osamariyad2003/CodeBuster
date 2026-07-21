"""Dead code analyzer.

Static, AST-based detection for Python:
  1. Unreachable code — statements that follow a return/raise/break/continue
     in the same block and can therefore never execute. High confidence,
     unambiguous bug.
  2. Possibly-unused module-private functions (`_foo`) — defined but never
     referenced elsewhere in the same file. Lower confidence heuristic
     (single-file only; a symbol could still be imported by another file).

JS/TS is intentionally not covered yet — reliable unreachable-code and
usage analysis needs a real parser (acorn/esprima), which isn't a current
dependency, and regex heuristics for this class of check produce too many
false positives to be worth shipping.
"""
import ast
import re
from typing import Any, Dict, List

_TERMINAL_STMTS = (ast.Return, ast.Raise, ast.Break, ast.Continue)
_BLOCK_FIELDS = ('body', 'orelse', 'finalbody')


class DeadCodeAnalyzer:
    """Finds unreachable code and likely-unused private functions in Python files."""

    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        findings: List[Dict[str, Any]] = []
        for f in files:
            path = f.get('path') or f.get('file') or ''
            content = f.get('content') or ''
            if not path.endswith('.py'):
                continue
            try:
                tree = ast.parse(content)
            except SyntaxError:
                continue
            findings += self._find_unreachable_code(path, tree)
            findings += self._find_unused_private_functions(path, content, tree)
        return findings

    def _find_unreachable_code(self, path: str, tree: ast.AST) -> List[Dict[str, Any]]:
        findings = []
        for node in ast.walk(tree):
            # ast.walk already visits ExceptHandler nodes directly (they have
            # their own 'body' list), so no separate 'handlers' pass is needed
            # here — adding one double-counts every except block.
            blocks = [
                getattr(node, field) for field in _BLOCK_FIELDS
                if isinstance(getattr(node, field, None), list) and getattr(node, field)
            ]

            for block in blocks:
                for i, stmt in enumerate(block[:-1]):
                    if isinstance(stmt, _TERMINAL_STMTS):
                        nxt = block[i + 1]
                        kind = type(stmt).__name__.lower()
                        findings.append({
                            'module': 'code_quality',
                            'severity': 'minor',
                            'category': 'unreachable_code',
                            'title': f'Unreachable code after {kind}',
                            'description': (
                                f"Line {nxt.lineno} can never execute — the preceding "
                                f"{kind} statement on line {stmt.lineno} always exits this block."
                            ),
                            'file': path,
                            'line': nxt.lineno,
                            'code_snippet': '',
                            'confidence': 0.95,
                            'tool': 'dead_code_analyzer',
                        })
                        break  # one finding per dead segment, not one per line
        return findings

    def _find_unused_private_functions(self, path: str, content: str, tree: ast.AST) -> List[Dict[str, Any]]:
        findings = []
        candidates = [
            (n.name, n.lineno) for n in getattr(tree, 'body', [])
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
            and n.name.startswith('_') and not n.name.startswith('__')
            and not n.decorator_list
        ]
        for name, lineno in candidates:
            occurrences = len(re.findall(r'\b' + re.escape(name) + r'\b', content))
            if occurrences <= 1:  # only the definition itself
                findings.append({
                    'module': 'code_quality',
                    'severity': 'info',
                    'category': 'dead_code',
                    'title': f"Possibly unused function '{name}'",
                    'description': (
                        f"'{name}' is defined but not referenced anywhere else in this file. "
                        "If nothing outside this file imports it either, it's dead code."
                    ),
                    'file': path,
                    'line': lineno,
                    'code_snippet': f'def {name}(...)',
                    'confidence': 0.5,
                    'tool': 'dead_code_analyzer',
                })
        return findings
