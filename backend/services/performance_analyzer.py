"""Performance analyzer — detects N+1 queries (AST + multi-line), algorithm hotspots,
JS/TS anti-patterns, and assigns variable confidence + critical severity where warranted."""
import re
import os
import ast
from typing import List, Dict, Any, Optional

try:
    import structlog
    logger = structlog.get_logger()
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


# ── confidence constants ─────────────────────────────────────────────────────
_C_CERTAIN   = 0.95   # SELECT *, obvious misuse
_C_HIGH      = 0.88   # AST-confirmed N+1
_C_MED_HIGH  = 0.80   # Strong pattern match
_C_MEDIUM    = 0.70   # Multi-line heuristic
_C_LOW       = 0.60   # Speculative / partial match


# ── Python AST visitor ───────────────────────────────────────────────────────
_PY_DB_METHODS = frozenset({
    # SQLAlchemy
    "query", "filter", "filter_by", "get", "get_or_404", "all", "first",
    "one", "one_or_none", "scalar", "count", "execute", "run_sync",
    # Django ORM
    "objects", "get", "filter", "exclude", "select_related",
    "prefetch_related", "annotate", "aggregate",
    # Generic
    "find", "find_one", "find_many", "fetch", "fetch_one", "fetch_all",
    "cursor", "fetchone", "fetchall", "fetchmany",
})

class _N1Visitor(ast.NodeVisitor):
    """Walk a Python AST, report DB-call nodes that appear inside a loop."""

    def __init__(self, source_lines: List[str]):
        self.source_lines = source_lines
        self.findings: List[Dict] = []
        self._loop_depth = 0
        self._loop_lines: List[int] = []   # start lines of enclosing loops

    def _enter_loop(self, node):
        self._loop_depth += 1
        self._loop_lines.append(node.lineno)
        self.generic_visit(node)
        self._loop_depth -= 1
        self._loop_lines.pop()

    visit_For   = _enter_loop
    visit_While = _enter_loop

    # Also catch list comprehensions with nested calls
    def visit_ListComp(self, node):
        self._loop_depth += 1
        self._loop_lines.append(node.lineno)
        self.generic_visit(node)
        self._loop_depth -= 1
        self._loop_lines.pop()

    visit_SetComp  = visit_ListComp
    visit_DictComp = visit_ListComp
    visit_GeneratorExp = visit_ListComp

    def visit_Call(self, node):
        if self._loop_depth > 0:
            call_name = self._get_call_name(node)
            if call_name and call_name.lower() in _PY_DB_METHODS:
                line = node.lineno
                snippet = (self.source_lines[line - 1].strip()
                           if 0 < line <= len(self.source_lines) else "")
                loop_line = self._loop_lines[-1] if self._loop_lines else line
                self.findings.append({
                    "line":      line,
                    "loop_line": loop_line,
                    "snippet":   snippet,
                    "call_name": call_name,
                })
        self.generic_visit(node)

    @staticmethod
    def _get_call_name(node: ast.Call) -> Optional[str]:
        func = node.func
        if isinstance(func, ast.Attribute):
            return func.attr
        if isinstance(func, ast.Name):
            return func.id
        return None


# ── helpers ──────────────────────────────────────────────────────────────────
def _ext(path: str) -> str:
    return os.path.splitext(path)[1].lower()


def _is_py(path: str) -> bool:
    return _ext(path) == ".py"


def _is_js(path: str) -> bool:
    return _ext(path) in {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}


def _finding(
    *,
    module="performance",
    severity,
    category,
    title,
    description,
    file,
    line,
    code_snippet="",
    tool="performance_analyzer",
    confidence,
    fix_explanation,
    references=None,
) -> Dict:
    return {
        "module":       module,
        "severity":     severity,
        "category":     category,
        "title":        title,
        "description":  description,
        "file":         file,
        "line":         line,
        "code_snippet": code_snippet,
        "tool":         tool,
        "confidence":   confidence,
        "suggested_fix": {
            "code":          "# See explanation below",
            "explanation":   fix_explanation,
            "safety_score":  0.9,
            "automated":     False,
        },
        "references":   references or [],
    }


# ── JS/TS block extractor ─────────────────────────────────────────────────────
def _extract_js_blocks(content: str, loop_re: re.Pattern) -> List[Dict]:
    """
    For each JS/TS loop header matching `loop_re`, extract the body up to the
    matching closing brace. Returns list of {header_line, body, body_start_line}.
    """
    lines = content.splitlines()
    blocks = []

    for m in loop_re.finditer(content):
        header_line = content[: m.start()].count("\n") + 1
        # find opening brace
        rest = content[m.end():]
        brace_pos = rest.find("{")
        if brace_pos == -1:
            continue
        depth = 0
        body_chars = []
        body_start_offset = m.end() + brace_pos + 1
        body_start_line = content[:body_start_offset].count("\n") + 1
        for ch in rest[brace_pos + 1:]:
            if ch == "{":
                depth += 1
            elif ch == "}":
                if depth == 0:
                    break
                depth -= 1
            body_chars.append(ch)
        body = "".join(body_chars)
        blocks.append({
            "header_line":     header_line,
            "body":            body,
            "body_start_line": body_start_line,
        })
    return blocks


# ── main analyzer class ───────────────────────────────────────────────────────
class PerformanceAnalyzer:
    """
    Multi-strategy performance analyzer.

    Strategies (in order of fidelity):
    1. SELECT * / raw-execute regex — near-certain, per line
    2. Python AST N+1 detection     — confirmed by parse tree
    3. Python regex patterns         — single-line heuristics
    4. JS/TS block-level N+1        — loop body extraction + query pattern
    5. JS/TS anti-pattern checks    — useEffect, async forEach, JSON in loop, etc.
    """

    # ── single-line SQL patterns ──────────────────────────────────────────
    _SQL_LINE_PATTERNS = [
        (
            r"SELECT\s+\*\s+FROM",
            "SELECT * — Wildcard Column Fetch",
            "Fetching all columns wastes memory and I/O. Specify only the columns you need.",
            "major",
            _C_CERTAIN,
            ["CWE-1049"],
        ),
        (
            r"execute\s*\(",
            "Raw SQL Execution",
            "Raw execute() bypasses ORM safety. Prefer parameterized queries or ORM methods.",
            "major",
            0.82,
            [],
        ),
    ]

    # ── Python single-line patterns ───────────────────────────────────────
    _PY_LINE_PATTERNS = [
        (
            r"\.all\(\)\s*$",
            "Unbounded .all() Query",
            ".all() fetches the entire table. Add .limit() or paginate to avoid loading "
            "thousands of rows into memory.",
            "major",
            0.85,
        ),
        (
            r"time\.sleep\s*\(",
            "Synchronous sleep() in Application Code",
            "time.sleep() blocks the worker thread entirely. Use async sleep (asyncio.sleep) "
            "or a task queue for deferred work.",
            "major",
            _C_CERTAIN,
        ),
        (
            r"for\s+\w+\s+in\s+.+:\s*\n(?:[ \t]+.+\n)*?[ \t]+for\s+\w+\s+in\s+",
            "Nested Loop — O(n²) Risk",
            "Nested iteration over collections can degrade to O(n²). "
            "Consider indexing the inner collection with a dict/set before the outer loop.",
            "major",
            0.72,
        ),
        (
            r"\.sort\s*\((?!.*key=)",
            "In-Memory Sort Without Key",
            "Sorting large sequences in Python without a key function may be slower than needed. "
            "For DB-backed data, prefer ORDER BY. For large in-memory sorts, ensure a key= is used.",
            "minor",
            0.65,
        ),
    ]

    # ── JS loop patterns ──────────────────────────────────────────────────
    _JS_LOOP_RE = re.compile(
        r"(?:"
        r"for\s*\(|"
        r"while\s*\(|"
        r"\.forEach\s*\(|"
        r"\.map\s*\(|"
        r"\.reduce\s*\(|"
        r"\.filter\s*\((?!\s*Boolean)"   # .filter(Boolean) is fine
        r")",
        re.MULTILINE,
    )

    # Patterns that indicate a DB/network call inside a JS loop body
    _JS_QUERY_RE = re.compile(
        r"(?:"
        r"await\s+(?:fetch|axios|got|request|superagent|http)\s*[\.(]|"
        r"\.(?:findOne|findById|find|findAll|query|execute|get|post|put|delete)\s*\(|"
        r"db\.|pool\.|conn\.|knex\.|sequelize\.|mongoose\.|prisma\."
        r")",
        re.IGNORECASE,
    )

    # ── JS/TS anti-pattern checks ─────────────────────────────────────────
    _JS_ANTIPATTERNS = [
        # async forEach (awaits are silently ignored)
        (
            r"\.forEach\s*\(\s*async\s",
            "async forEach — Awaits Are Silently Ignored",
            "async callbacks inside forEach are not awaited. Use `for...of` with await, "
            "or `Promise.all(array.map(async ...))` to correctly await all iterations.",
            "major",
            _C_HIGH,
        ),
        # JSON.parse / JSON.stringify in a loop context (single-line shortcut)
        (
            r"(?:JSON\.parse|JSON\.stringify)\s*\(",
            "JSON Serialization Inside Loop",
            "JSON.parse/stringify are CPU-intensive. Calling them inside a loop can be a "
            "bottleneck. Cache the result outside the loop if the value does not change.",
            "minor",
            _C_MEDIUM,
        ),
        # document.querySelector / getElementById inside loops
        (
            r"document\.(?:querySelector|getElementById|getElementsBy\w+)\s*\(",
            "DOM Query Inside Loop",
            "DOM queries trigger layout and are expensive. Cache the element reference "
            "outside the loop.",
            "major",
            _C_MED_HIGH,
        ),
        # Spread of potentially large objects inside loops
        (
            r"\{\s*\.\.\.\w+",
            "Object Spread May Copy Large Object",
            "Spreading objects inside tight loops creates many short-lived allocations. "
            "Consider mutating a single accumulator object instead.",
            "minor",
            _C_LOW,
        ),
        # useEffect without dependency array
        (
            r"useEffect\s*\(\s*(?:async\s*)?\(\s*\)\s*=>",
            "useEffect Missing Dependency Array",
            "useEffect without a dependency array runs after every render, which is almost "
            "never intentional. Add [] for mount-only, or list the actual deps.",
            "major",
            0.78,
        ),
        # Array.find / Array.includes nested inside map/filter/forEach
        (
            r"\.(?:map|filter|forEach|reduce)\s*\([^)]*\barray\b[^)]*\.(?:find|includes|indexOf)\s*\(",
            "O(n²) — Nested Array Search Inside Iteration",
            "Calling .find/.includes inside .map/.filter iterates the inner array for "
            "every element of the outer one. Build a Set or Map from the inner array first.",
            "critical",
            _C_HIGH,
        ),
        # setInterval / setTimeout with 0 delay calling heavy ops
        (
            r"setInterval\s*\(",
            "setInterval — Potential Unbounded Execution",
            "setInterval fires indefinitely. Ensure the interval is cleared when the "
            "component unmounts or the job is done.",
            "minor",
            0.60,
        ),
    ]

    # ── public entry point ────────────────────────────────────────────────
    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        findings: List[Dict] = []
        for file_info in files:
            path    = file_info.get("path", file_info.get("filename", "unknown"))
            content = file_info.get("content", "")
            if not content or not path:
                continue

            findings.extend(self._sql_line_checks(path, content))

            if _is_py(path):
                findings.extend(self._python_ast_n1(path, content))
                findings.extend(self._python_line_checks(path, content))

            if _is_js(path):
                findings.extend(self._js_block_n1(path, content))
                findings.extend(self._js_antipattern_checks(path, content))

        return findings

    # ── strategy 1: per-line SQL ──────────────────────────────────────────
    def _sql_line_checks(self, path: str, content: str) -> List[Dict]:
        out = []
        lines = content.splitlines()
        for ln, line in enumerate(lines, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith(("#", "//", "*", "/*")):
                continue
            for pattern, title, desc, severity, conf, refs in self._SQL_LINE_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    out.append(_finding(
                        severity=severity, category="sql_efficiency",
                        title=title, description=desc,
                        file=path, line=ln, code_snippet=stripped,
                        confidence=conf, fix_explanation=desc,
                        references=refs,
                    ))
        return out

    # ── strategy 2: Python AST N+1 ───────────────────────────────────────
    def _python_ast_n1(self, path: str, content: str) -> List[Dict]:
        out = []
        try:
            tree = ast.parse(content, filename=path)
        except SyntaxError:
            return out
        source_lines = content.splitlines()
        visitor = _N1Visitor(source_lines)
        visitor.visit(tree)
        for hit in visitor.findings:
            out.append(_finding(
                severity="critical",
                category="n_plus_one_query",
                title="N+1 Query — DB Call Inside Loop",
                description=(
                    f"`.{hit['call_name']}()` is called inside a loop that starts at "
                    f"line {hit['loop_line']}. This sends one query per iteration, which "
                    "degrades to O(n) round-trips. Use eager loading, batch fetching, or "
                    "pull the query outside the loop."
                ),
                file=path, line=hit["line"], code_snippet=hit["snippet"],
                confidence=_C_HIGH,
                fix_explanation=(
                    "For SQLAlchemy use joinedload() / selectinload(). "
                    "For Django ORM use select_related() / prefetch_related(). "
                    "For raw queries, fetch all needed IDs in one query and build a dict."
                ),
                references=["CWE-1049"],
            ))
        return out

    # ── strategy 3: Python single-line patterns ───────────────────────────
    def _python_line_checks(self, path: str, content: str) -> List[Dict]:
        out = []
        lines = content.splitlines()
        for ln, line in enumerate(lines, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            for pattern, title, desc, severity, conf in self._PY_LINE_PATTERNS:
                if re.search(pattern, line, re.MULTILINE):
                    out.append(_finding(
                        severity=severity, category="algo_efficiency",
                        title=title, description=desc,
                        file=path, line=ln, code_snippet=stripped,
                        confidence=conf, fix_explanation=desc,
                    ))
        return out

    # ── strategy 4: JS/TS block-level N+1 ────────────────────────────────
    def _js_block_n1(self, path: str, content: str) -> List[Dict]:
        out = []
        blocks = _extract_js_blocks(content, self._JS_LOOP_RE)
        for block in blocks:
            for m in self._JS_QUERY_RE.finditer(block["body"]):
                hit_line = block["body_start_line"] + block["body"][:m.start()].count("\n")
                lines = content.splitlines()
                snippet = lines[hit_line - 1].strip() if 0 < hit_line <= len(lines) else ""
                out.append(_finding(
                    severity="critical",
                    category="n_plus_one_query",
                    title="N+1 Query — Network/DB Call Inside JS Loop",
                    description=(
                        f"A database or network call was found inside a loop body "
                        f"(loop at line {block['header_line']}). This causes one "
                        "request per iteration. Batch the calls outside the loop."
                    ),
                    file=path, line=hit_line, code_snippet=snippet,
                    confidence=_C_MEDIUM,
                    fix_explanation=(
                        "Collect all IDs/keys first, then make one batched request. "
                        "For React Query / SWR use batch-fetch hooks. "
                        "For Prisma/Sequelize use findMany with an IN clause."
                    ),
                    references=["CWE-1049"],
                ))
        return out

    # ── strategy 5: JS/TS anti-patterns (per line) ───────────────────────
    def _js_antipattern_checks(self, path: str, content: str) -> List[Dict]:
        out = []
        lines = content.splitlines()
        for ln, line in enumerate(lines, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith(("//", "*", "/*")):
                continue
            for pattern, title, desc, severity, conf in self._JS_ANTIPATTERNS:
                if re.search(pattern, line):
                    out.append(_finding(
                        severity=severity, category="js_perf_antipattern",
                        title=title, description=desc,
                        file=path, line=ln, code_snippet=stripped,
                        confidence=conf, fix_explanation=desc,
                    ))
        return out
