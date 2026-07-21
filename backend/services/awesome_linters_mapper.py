"""Cross-references SonarQube rules with known linter rules from the Awesome-Linters ecosystem.

Reference: https://github.com/caramelomartins/awesome-linters
"""
from typing import Dict, List


def _ref(name: str, rule_id: str, desc: str) -> Dict[str, str]:
    return {"linter_name": name, "linter_rule_id": rule_id, "linter_rule_desc": desc}


# Direct SonarQube rule -> linter rule mapping
RULE_MAPPING: Dict[str, List[Dict[str, str]]] = {
    # Python rules
    "python:S1192": [_ref("pylint", "R0801", "Duplicate code / string literal duplication")],
    "python:S107":  [_ref("pylint", "R0913", "Too many arguments")],
    "python:S3776": [
        _ref("pylint", "R1260", "Too complex (cognitive complexity)"),
        _ref("flake8", "C901", "Function is too complex"),
    ],
    "python:S1134": [_ref("pylint", "W0511", "TODO/FIXME found")],
    "python:S5806": [_ref("ruff", "E711", "Comparison to None")],
    "python:S1481": [
        _ref("pylint", "W0612", "Unused variable"),
        _ref("ruff", "F841", "Local variable is assigned but never used"),
    ],
    "python:S1186": [_ref("pylint", "W0107", "Unnecessary pass statement")],
    "python:S5720": [_ref("pylint", "E0102", "Function already defined")],
    "python:S930":  [_ref("pylint", "E1121", "Too many positional arguments")],
    "python:S5722": [_ref("bandit", "B101", "Use of assert detected")],
    "python:S4423": [_ref("bandit", "B505", "Weak cryptographic key size")],
    "python:S2077": [
        _ref("bandit", "B608", "Possible SQL injection via string formatting"),
        _ref("semgrep", "python.lang.security.audit.formatted-sql-query", "SQL injection risk"),
    ],
    "python:S5131": [_ref("semgrep", "python.flask.security.xss.audit.direct-use-of-jinja2", "XSS risk in Jinja2")],
    "python:S4830": [_ref("bandit", "B501", "Request with no cert verification")],

    # JavaScript / TypeScript rules
    "javascript:S3776": [
        _ref("eslint", "complexity", "Cyclomatic complexity threshold"),
        _ref("jshint", "W074", "Function complexity"),
    ],
    "javascript:S1481": [_ref("eslint", "no-unused-vars", "Disallow unused variables")],
    "javascript:S1854": [_ref("eslint", "no-unused-expressions", "Disallow unused expressions")],
    "javascript:S3723": [_ref("eslint", "no-misleading-character-class", "Misleading character class")],
    "javascript:S2068": [_ref("eslint-plugin-security", "detect-hardcoded-credentials", "Hardcoded credentials")],
    "javascript:S2245": [_ref("eslint-plugin-security", "detect-pseudo-random-bytes", "Insecure randomness")],
    "javascript:S1128": [_ref("eslint", "no-unused-vars", "Unused import / variable")],
    "javascript:S6544": [_ref("eslint", "no-floating-promises", "Unhandled promise")],
    "typescript:S3776": [_ref("eslint", "complexity", "Cyclomatic complexity threshold")],
    "typescript:S1481": [_ref("eslint", "@typescript-eslint/no-unused-vars", "Disallow unused variables")],

    # Java rules
    "java:S3776":  [_ref("checkstyle", "CyclomaticComplexity", "Cyclomatic complexity threshold")],
    "java:S1481":  [_ref("pmd", "UnusedLocalVariable", "Unused local variable")],
    "java:S2077":  [_ref("spotbugs", "SQL_INJECTION", "SQL injection vulnerability")],
    "java:S2259":  [_ref("spotbugs", "NP_NULL_ON_SOME_PATH", "Null pointer dereference")],

    # Go rules
    "go:S3776":    [_ref("golangci-lint", "gocyclo", "Cyclomatic complexity")],
    "go:S1481":    [_ref("golangci-lint", "unused", "Unused variable")],
}

# Category-level fallback: (issue_type, language) -> generic linter references
CATEGORY_LINTER_MAPPING: Dict[tuple, List[Dict[str, str]]] = {
    ("BUG", "py"):            [_ref("pylint", "*", "General Python bug detection"),
                               _ref("mypy", "*", "Type checking")],
    ("CODE_SMELL", "py"):     [_ref("pylint", "*", "Code smell detection"),
                               _ref("ruff", "*", "Fast Python linting"),
                               _ref("flake8", "*", "Style guide enforcement")],
    ("VULNERABILITY", "py"):  [_ref("bandit", "*", "Security-focused linting"),
                               _ref("semgrep", "*", "Semantic pattern matching")],
    ("BUG", "js"):            [_ref("eslint", "*", "JavaScript bug detection")],
    ("CODE_SMELL", "js"):     [_ref("eslint", "*", "Style and quality"),
                               _ref("jshint", "*", "JavaScript quality tool")],
    ("VULNERABILITY", "js"):  [_ref("eslint-plugin-security", "*", "Security rules for ESLint")],
    ("BUG", "java"):          [_ref("spotbugs", "*", "Java bug detection"),
                               _ref("pmd", "*", "Java static analysis")],
    ("CODE_SMELL", "java"):   [_ref("checkstyle", "*", "Java style enforcement")],
    ("VULNERABILITY", "java"): [_ref("spotbugs", "*", "Java security analysis")],
    ("BUG", "go"):            [_ref("golangci-lint", "*", "Go linting aggregator")],
    ("CODE_SMELL", "go"):     [_ref("golangci-lint", "*", "Go linting aggregator")],
}


EXTENSION_TO_LANG = {
    '.py': 'py',
    '.js': 'js', '.jsx': 'js', '.ts': 'js', '.tsx': 'js',
    '.java': 'java',
    '.go': 'go',
    '.rb': 'rb',
    '.rs': 'rust',
    '.c': 'c', '.cpp': 'c', '.h': 'c',
}


class AwesomeLintersMapper:
    """Cross-references SonarQube rules with known linter rules from the Awesome-Linters ecosystem."""

    def get_linter_references(
        self,
        sonarqube_rule_key: str,
        issue_type: str = None,
        file_path: str = None,
    ) -> List[Dict[str, str]]:
        """Return matching linter references for a SonarQube rule.

        1. Direct rule mapping (exact match on rule key)
        2. Category-level fallback (issue_type + detected language)
        """
        # 1. Direct rule mapping
        refs = RULE_MAPPING.get(sonarqube_rule_key, [])
        if refs:
            return list(refs)

        # 2. Category-level fallback
        if issue_type and file_path:
            lang = self._detect_language(file_path)
            refs = CATEGORY_LINTER_MAPPING.get((issue_type, lang), [])
            if refs:
                return list(refs)

        return []

    def _detect_language(self, file_path: str) -> str:
        """Detect language from file extension."""
        for ext, lang in EXTENSION_TO_LANG.items():
            if file_path.endswith(ext):
                return lang
        return 'unknown'
