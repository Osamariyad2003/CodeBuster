"""Duplicate / copy-paste code detector.

Lightweight, language-agnostic clone detection: each file is split into
non-overlapping chunks of consecutive "meaningful" lines (blank lines,
comment-only lines, and import-only chunks are filtered out to cut noise),
each chunk is normalized (whitespace collapsed) and hashed, and any hash
that recurs across two or more locations is reported as a duplicate block.

This is chunk-aligned rather than a full sliding window on purpose — a
sliding window would report every overlapping offset of the same
duplication and drown real findings in near-duplicates. The tradeoff is
that a clone whose boundary doesn't line up with a chunk boundary can be
missed; that's an acceptable cost for a fast, dependency-free pass.
"""
import hashlib
import re
from typing import Any, Dict, List, Tuple

MIN_BLOCK_LINES = 6          # chunk size, in meaningful lines
MIN_BLOCK_CHARS = 80         # skip chunks that are too short to be a meaningful clone
MAX_LOCATIONS_REPORTED = 5   # cap evidence list length per duplicate group

_COMMENT_RE = re.compile(r'^\s*(#|//|/\*|\*|--)')
_IMPORT_RE = re.compile(r'^\s*(import\s|from\s.+\simport\s|require\(|const\s.+=\s*require\()')


class DuplicateCodeAnalyzer:
    """Finds copy-pasted code blocks within and across files."""

    def analyze(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # hash -> list of (file, start_line, end_line, snippet)
        groups: Dict[str, List[Tuple[str, int, int, str]]] = {}

        for f in files:
            path = f.get('path') or f.get('file') or ''
            content = f.get('content') or ''
            if not path or not content:
                continue
            for start_line, end_line, snippet, normalized in self._chunk_file(content):
                if len(normalized) < MIN_BLOCK_CHARS:
                    continue
                h = hashlib.sha256(normalized.encode('utf-8', errors='ignore')).hexdigest()
                groups.setdefault(h, []).append((path, start_line, end_line, snippet))

        findings = []
        for locations in groups.values():
            if len(locations) < 2:
                continue
            origin = locations[0]
            for dup in locations[1:]:
                other_locations = [origin] + [l for l in locations[1:] if l is not dup]
                evidence = [f"{loc[0]}:{loc[1]}-{loc[2]}" for loc in other_locations[:MAX_LOCATIONS_REPORTED]]
                findings.append({
                    'module': 'code_quality',
                    'severity': 'minor',
                    'category': 'duplicate_code',
                    'title': f'Duplicate code block ({len(locations)} occurrences)',
                    'description': (
                        f"Lines {dup[1]}-{dup[2]} in {dup[0]} duplicate a {MIN_BLOCK_LINES}+ line block "
                        f"found in {len(locations) - 1} other location(s). Consider extracting a shared "
                        "function/module to keep fixes and behavior changes in one place."
                    ),
                    'file': dup[0],
                    'line': dup[1],
                    'code_snippet': dup[3][:400],
                    'confidence': 0.7,
                    'tool': 'duplicate_code_analyzer',
                    'evidence': evidence,
                })
        return findings

    def _chunk_file(self, content: str):
        lines = content.splitlines()
        meaningful = [(i + 1, line) for i, line in enumerate(lines) if line.strip() and not _COMMENT_RE.match(line)]

        for start in range(0, len(meaningful), MIN_BLOCK_LINES):
            chunk = meaningful[start:start + MIN_BLOCK_LINES]
            if len(chunk) < MIN_BLOCK_LINES:
                break  # trailing partial chunk — too short to be a reliable clone signal
            if all(_IMPORT_RE.match(line) for _, line in chunk):
                continue  # a block of pure imports is not a meaningful duplication
            start_line = chunk[0][0]
            end_line = chunk[-1][0]
            snippet = '\n'.join(line for _, line in chunk)
            normalized = '\n'.join(re.sub(r'\s+', ' ', line).strip() for _, line in chunk)
            yield start_line, end_line, snippet, normalized
