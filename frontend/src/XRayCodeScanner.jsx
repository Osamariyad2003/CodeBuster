import React, { useState, useEffect, useRef, useCallback } from 'react';
import { codebusterApi } from './api/codebuster';
import './XRayCodeScanner.css';

// ── PLACEHOLDER CODE POOLS ────────────────────────────────────────────────────
// Used for non-finding context lines (real source code is not available).

const JS_POOL = [
  "import { createContext, useContext, useReducer } from 'react';",
  "import { z } from 'zod';",
  "import { logger } from '../utils/logger';",
  "",
  "const CLIENT_TIMEOUT_MS = 5_000;",
  "const MAX_RETRIES = 3;",
  "",
  "export class ServiceClient {",
  "  private readonly baseUrl: string;",
  "  private readonly headers: Record<string, string>;",
  "",
  "  constructor(baseUrl: string, apiKey: string) {",
  "    this.baseUrl = baseUrl;",
  "    this.headers = { 'Authorization': `Bearer ${apiKey}`,",
  "                     'Content-Type': 'application/json' };",
  "  }",
  "",
  "  async get<T>(path: string): Promise<T> {",
  "    const res = await fetch(`${this.baseUrl}${path}`, {",
  "      headers: this.headers,",
  "      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),",
  "    });",
  "    if (!res.ok) throw new Error(`HTTP ${res.status}`);",
  "    return res.json();",
  "  }",
  "",
  "  async post<T>(path: string, body: unknown): Promise<T> {",
  "    const res = await fetch(`${this.baseUrl}${path}`, {",
  "      method: 'POST',",
  "      headers: this.headers,",
  "      body: JSON.stringify(body),",
  "    });",
  "    if (!res.ok) throw new Error(`HTTP ${res.status}`);",
  "    return res.json();",
  "  }",
  "}",
  "",
  "export function useAuth() {",
  "  const ctx = useContext(AuthContext);",
  "  if (!ctx) throw new Error('useAuth must be inside AuthProvider');",
  "  return ctx;",
  "}",
  "",
  "const initialState = { user: null, token: null, loading: false };",
  "",
  "function reducer(state, action) {",
  "  switch (action.type) {",
  "    case 'LOGIN':  return { ...state, user: action.payload, loading: false };",
  "    case 'LOGOUT': return initialState;",
  "    default:       return state;",
  "  }",
  "}",
  "",
  "export class TokenManager {",
  "  static store(token)   { localStorage.setItem('__tok', token); }",
  "  static retrieve()     { return localStorage.getItem('__tok'); }",
  "  static revoke()       { localStorage.removeItem('__tok'); }",
  "}",
];

const PY_POOL = [
  "from __future__ import annotations",
  "import asyncio, logging",
  "from typing import Optional, Any",
  "from dataclasses import dataclass, field",
  "",
  "logger = logging.getLogger(__name__)",
  "",
  "@dataclass",
  "class Config:",
  "    db_url: str",
  "    pool_size: int = 10",
  "    timeout: float = 30.0",
  "    debug: bool = False",
  "",
  "class Repository:",
  "    def __init__(self, session):",
  "        self.session = session",
  "",
  "    async def find_by_id(self, id: int) -> Optional[dict]:",
  "        result = await self.session.execute(",
  "            'SELECT * FROM records WHERE id = $1', (id,)",
  "        )",
  "        return dict(result) if result else None",
  "",
  "    async def create(self, payload: dict) -> dict:",
  "        validated = self._validate(payload)",
  "        record = await self.session.execute(",
  "            'INSERT INTO records (data) VALUES ($1) RETURNING *',",
  "            (validated,)",
  "        )",
  "        return dict(record)",
  "",
  "    def _validate(self, payload: dict) -> dict:",
  "        required = ['name', 'type']",
  "        missing = [k for k in required if k not in payload]",
  "        if missing:",
  "            raise ValueError(f'Missing fields: {missing}')",
  "        return payload",
  "",
  "async def main() -> None:",
  "    cfg = Config(db_url=os.environ['DATABASE_URL'])",
  "    async with create_pool(cfg) as pool:",
  "        repo = Repository(pool)",
  "        result = await repo.find_by_id(1)",
  "        logger.info('Found record: %s', result)",
];

const JAVA_POOL = [
  "package com.example.service;",
  "",
  "import java.util.Optional;",
  "import java.util.concurrent.CompletableFuture;",
  "import org.springframework.stereotype.Service;",
  "import org.springframework.transaction.annotation.Transactional;",
  "",
  "@Service",
  "public class UserService {",
  "    private final UserRepository repo;",
  "    private final PasswordEncoder encoder;",
  "",
  "    public UserService(UserRepository repo, PasswordEncoder encoder) {",
  "        this.repo    = repo;",
  "        this.encoder = encoder;",
  "    }",
  "",
  "    @Transactional(readOnly = true)",
  "    public Optional<User> findById(Long id) {",
  "        return repo.findById(id);",
  "    }",
  "",
  "    @Transactional",
  "    public User create(CreateUserRequest req) {",
  "        if (repo.existsByEmail(req.getEmail())) {",
  "            throw new ConflictException(\"Email already in use\");",
  "        }",
  "        User user = new User();",
  "        user.setEmail(req.getEmail());",
  "        user.setPassword(encoder.encode(req.getPassword()));",
  "        return repo.save(user);",
  "    }",
  "}",
];

const GENERIC_POOL = [
  "// initialisation",
  "const VERSION = '2.4.1';",
  "const ENV = process['env'].NODE_ENV ?? 'development';",
  "",
  "function init(config) {",
  "  validate(config);",
  "  setup(config.options);",
  "  return { version: VERSION, env: ENV };",
  "}",
  "",
  "function validate(cfg) {",
  "  if (!cfg) throw new Error('config required');",
  "  if (!cfg.apiKey) throw new Error('apiKey required');",
  "}",
  "",
  "module.exports = { init };",
];

function getPool(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (['py'].includes(ext))                     return PY_POOL;
  if (['java', 'kt'].includes(ext))             return JAVA_POOL;
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return JS_POOL;
  return GENERIC_POOL;
}

function placeholderLine(filename, realLineNum) {
  const pool = getPool(filename);
  return pool[realLineNum % pool.length] ?? '';
}

// ── SEVERITY ──────────────────────────────────────────────────────────────────

function normalizeSev(raw) {
  const s = (raw || '').toLowerCase();
  if (s === 'critical' || s === 'high')                        return 'critical';
  if (s === 'major' || s === 'warning' || s === 'medium')     return 'warning';
  if (s === 'minor' || s === 'low')                            return 'warning';
  return 'info';
}

const SEV = {
  critical: { label: 'CRITICAL', icon: '⚠', color: '#FF0055' },
  warning:  { label: 'WARN',     icon: '◉', color: '#FFB800' },
  info:     { label: 'INFO',     icon: 'ℹ', color: '#00F0FF' },
};

// ── FILE METADATA ─────────────────────────────────────────────────────────────

const EXT_LANG = {
  js: 'JavaScript', jsx: 'React JSX', ts: 'TypeScript', tsx: 'React TSX',
  py: 'Python', java: 'Java', kt: 'Kotlin', go: 'Go',
  rb: 'Ruby', rs: 'Rust', cpp: 'C++', c: 'C',
  cs: 'C#', php: 'PHP', sh: 'Shell', yaml: 'YAML', json: 'JSON',
};

const EXT_COLOR = {
  js: '#F7DF1E', jsx: '#61DAFB', ts: '#3178C6', tsx: '#61DAFB',
  py: '#3572A5', java: '#B07219', kt: '#A97BFF', go: '#00ADD8',
  rb: '#CC342D', rs: '#DEA584', cpp: '#F34B7D', cs: '#178600',
  php: '#4F5D95', sh: '#89E051', json: '#9CA3AF', yaml: '#CB171E',
};

function getLanguage(f) {
  return EXT_LANG[(f.split('.').pop() || '').toLowerCase()] || 'Code';
}

function extColor(f) {
  return EXT_COLOR[(f.split('.').pop() || '').toLowerCase()] || '#8890A4';
}

// ── BUILD SCAN DATA FROM FINDINGS ─────────────────────────────────────────────

const CONTEXT_LINES       = 4;
const MAX_FILES           = 8;
const LINE_HEIGHT         = 22;
const STUB_LINE_COUNT     = 12;   // lines shown for findings with no line numbers
const MAX_SNIPPET_CHARS   = 120;  // truncate code_snippet to this width
const SEV_WEIGHT_CRITICAL = 10;   // file-ranking weights by severity
const SEV_WEIGHT_WARNING  = 3;
const SEV_WEIGHT_INFO     = 1;
const TREE_INDENT_STEP    = 14;   // px per depth level in file tree
const TREE_INDENT_BASE    = 10;   // px left padding for depth-0 nodes
const FILE_SWITCH_DELAY   = 900;  // ms pause between scanning files
const ELLIPSIS_SKIP_MS    = 28;   // ms to advance past an ellipsis row
const AGENT_LOG_MAX       = 7;    // max entries shown in the agent log
const LASER_Y_OFFSET      = 8;    // px top-padding offset for laser position

function buildScanData(findings) {
  if (!findings?.length) return { fileData: {}, fileTree: [], scanQueue: [] };

  // Group by file, drop findings without a file path
  const byFile = {};
  findings.forEach(f => {
    if (!f.file) return;
    if (!byFile[f.file]) byFile[f.file] = [];
    byFile[f.file].push(f);
  });

  // Rank files by weighted severity; take top MAX_FILES
  const ranked = Object.entries(byFile)
    .map(([file, flist]) => ({
      file, flist,
      weight: flist.reduce((s, f) => {
        const sv = normalizeSev(f.severity);
        return s + (sv === 'critical' ? SEV_WEIGHT_CRITICAL : sv === 'warning' ? SEV_WEIGHT_WARNING : SEV_WEIGHT_INFO);
      }, 0),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_FILES);

  const fileData = {};
  const allPaths = [];

  ranked.forEach(({ file, flist }) => {
    allPaths.push(file);

    const sorted = [...flist]
      .filter(f => f.start_line || f.line)
      .sort((a, b) => (a.start_line || a.line || 0) - (b.start_line || b.line || 0));

    if (!sorted.length) {
      fileData[file] = {
        language:   getLanguage(file),
        lines:      Array.from({ length: STUB_LINE_COUNT }, (_, i) => placeholderLine(file, i + 1)),
        lineNums:   Array.from({ length: STUB_LINE_COUNT }, (_, i) => i + 1),
        isEllipsis: Array(STUB_LINE_COUNT).fill(false),
        issues:     {},
      };
      return;
    }

    // Build windowed view: CONTEXT_LINES before/after each finding, ellipsis between gaps
    const lines       = [];
    const lineNums    = [];
    const isEllipsis  = [];
    const issues      = {};
    let lastEnd       = -1;

    sorted.forEach(finding => {
      const realLine = finding.start_line || finding.line || 1;
      const winStart = Math.max(1, realLine - CONTEXT_LINES);
      const winEnd   = realLine + CONTEXT_LINES;

      if (winStart > lastEnd + 1) {
        lines.push(null);
        lineNums.push(null);
        isEllipsis.push(true);
      }

      for (let ln = Math.max(winStart, lastEnd + 1); ln <= winEnd; ln++) {
        const isFindingLine = (ln === realLine);
        const text = (isFindingLine && finding.code_snippet)
          ? finding.code_snippet.trim().split('\n')[0].slice(0, MAX_SNIPPET_CHARS)
          : placeholderLine(file, ln);

        lines.push(text);
        lineNums.push(ln);
        isEllipsis.push(false);

        if (isFindingLine) {
          issues[lines.length] = {              // 1-indexed display position
            id:       finding.id || null,
            severity: normalizeSev(finding.severity),
            message:  finding.message || finding.description || 'Issue detected',
            category: finding.category || null,
          };
        }
      }

      lastEnd = winEnd;
    });

    fileData[file] = { language: getLanguage(file), lines, lineNums, isEllipsis, issues };
  });

  return {
    fileData,
    fileTree:  buildTree(allPaths),
    scanQueue: ranked.map(r => r.file),
  };
}

// ── BUILD NESTED TREE FROM FILE PATHS ────────────────────────────────────────

function buildTree(paths) {
  const root = {};
  paths.forEach(p => {
    const parts = p.replace(/^\//, '').split('/');
    let node = root;
    parts.forEach((part, i) => {
      if (!node[part]) {
        node[part] = i === parts.length - 1
          ? { __file: true, fullPath: p, ext: part.split('.').pop() }
          : {};
      }
      if (i < parts.length - 1) node = node[part];
    });
  });

  function toNodes(obj) {
    return Object.entries(obj)
      .filter(([k]) => !['__file', 'fullPath', 'ext'].includes(k))
      .map(([k, v]) => v.__file
        ? { name: k, type: 'file', ext: v.ext, fullPath: v.fullPath }
        : { name: k, type: 'folder', children: toNodes(v) }
      )
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  return toNodes(root);
}

// ── SYNTAX HIGHLIGHTER ────────────────────────────────────────────────────────

function highlight(raw) {
  if (!raw || !raw.trim()) return ' ';
  const esc = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/(\/\/[^\n]*)$/gm, '<span class="tok-cmt">$1</span>')
    .replace(/(#[^!{}\n][^\n]*)$/gm, '<span class="tok-cmt">$1</span>')
    .replace(/(`[^`]*`)/g, '<span class="tok-tmpl">$1</span>')
    .replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, '<span class="tok-str">$1</span>')
    .replace(/\b(import|export|from|const|let|var|function|async|await|return|if|else|new|this|class|delete|null|undefined|true|false|typeof|default|def|self|public|private|static|void)\b/g, '<span class="tok-kw">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
}

// ── FILE TREE COMPONENT ───────────────────────────────────────────────────────

function FileTreeNode({ node, activeFile, depth }) {
  const [open, setOpen] = useState(true);
  const indent = depth * TREE_INDENT_STEP + TREE_INDENT_BASE;

  if (node.type === 'folder') {
    return (
      <li className="ft-item">
        <button className="ft-folder" onClick={() => setOpen(o => !o)} style={{ paddingLeft: indent }}>
          <span className="ft-chevron">{open ? '▾' : '▸'}</span>
          <span className="ft-folder-icon">⊟</span>
          <span className="ft-name">{node.name}</span>
        </button>
        {open && node.children?.length > 0 && (
          <ul className="ft-list">
            {node.children.map(c => (
              <FileTreeNode key={c.fullPath || c.name} node={c} activeFile={activeFile} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const isActive = node.fullPath === activeFile;
  return (
    <li className={`ft-item ft-file${isActive ? ' ft-file--active' : ''}`}>
      <div className="ft-file-row" style={{ paddingLeft: indent }}>
        <span className="ft-file-dot" style={{ background: extColor(node.name) }} />
        <span className="ft-file-name" title={node.fullPath}>{node.name}</span>
        {isActive && <span className="ft-scanning-badge">ACTIVE</span>}
      </div>
    </li>
  );
}

function FileTree({ nodes, activeFile }) {
  if (!nodes?.length) return <div className="xrs-empty-tree">No findings</div>;
  return (
    <ul className="ft-list ft-root">
      {nodes.map(n => (
        <FileTreeNode key={n.fullPath || n.name} node={n} activeFile={activeFile} depth={0} />
      ))}
    </ul>
  );
}

// ── REPO LIST COMPONENT ───────────────────────────────────────────────────────

function gradeColor(grade) {
  const g = (grade || '').toUpperCase();
  if (g === 'A') return '#00C853';
  if (g === 'B') return '#64DD17';
  if (g === 'C') return '#FFD600';
  if (g === 'D') return '#FF6D00';
  return '#FF0055';
}

function RepoList({ repos, health, activeRepoId, loading, onSelect }) {
  if (loading) {
    return (
      <div className="xrs-repo-list">
        {[1, 2, 3].map(i => (
          <div key={i} className="xrs-repo-skeleton">
            <div className="xrs-skel-line xrs-skel-line--wide" />
            <div className="xrs-skel-line xrs-skel-line--narrow" />
          </div>
        ))}
      </div>
    );
  }

  if (!repos.length) {
    return <div className="xrs-repo-empty">No repositories connected</div>;
  }

  return (
    <div className="xrs-repo-list">
      {repos.map(repo => {
        const h         = health[repo.id];
        const isActive  = repo.id === activeRepoId;
        const grade     = h?.latest_grade;
        const score     = h?.latest_score;
        const hasReview = !!h?.latest_review_id;
        const parts     = repo.full_name.split('/');
        const owner     = parts[0] || '';
        const name      = parts[1] || repo.full_name;

        return (
          <div
            key={repo.id}
            className={`xrs-repo-card${isActive ? ' xrs-repo-card--active' : ''}${!hasReview ? ' xrs-repo-card--dim' : ''}`}
            onClick={() => hasReview && onSelect(repo.id)}
            title={repo.full_name}
          >
            <div className="xrs-repo-top">
              <span className="xrs-repo-owner">{owner}/</span>
              <span className="xrs-repo-name">{name}</span>
            </div>
            <div className="xrs-repo-bottom">
              {grade ? (
                <>
                  <span className="xrs-grade-pill" style={{ borderColor: gradeColor(grade), color: gradeColor(grade) }}>
                    {grade}
                  </span>
                  <span className="xrs-score-val">{Math.round(score ?? 0)}</span>
                </>
              ) : (
                <span className="xrs-no-review">no review yet</span>
              )}
              {isActive && <span className="xrs-active-indicator" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const SCAN_SPEED_MS    = 80;
const ISSUE_PAUSE_MULT = 6;

export default function XRayCodeScanner() {
  // ── Data state
  const [repos,        setRepos]        = useState([]);
  const [repoHealth,   setRepoHealth]   = useState({});
  const [activeRepoId, setActiveRepoId] = useState(null);
  const [fileData,     setFileData]     = useState({});
  const [fileTree,     setFileTree]     = useState([]);
  const [scanQueue,    setScanQueue]    = useState([]);
  const [repoScore,    setRepoScore]    = useState(null);
  const [repoGrade,    setRepoGrade]    = useState(null);
  const [reviewId,     setReviewId]     = useState(null);
  const [dismissed,    setDismissed]    = useState(new Set());

  // ── Scan animation state
  const [fileIndex,   setFileIndex]   = useState(0);
  const [currentLine, setCurrentLine] = useState(0);
  const [fileIssues,  setFileIssues]  = useState({});
  const [allIssues,   setAllIssues]   = useState([]);
  const [scanning,    setScanning]    = useState(false);
  const [complete,    setComplete]    = useState(false);

  // ── UI state
  const [loadingRepos,  setLoadingRepos]  = useState(true);
  const [loadingReview, setLoadingReview] = useState(false);
  const [error,         setError]         = useState(null);

  const viewerRef     = useRef(null);
  const lineRefs      = useRef([]);
  const discoveredRef = useRef(new Set());

  // ── Load all repos on mount ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const list = await codebusterApi.getRepos();
        setRepos(list);

        const hMap = {};
        await Promise.allSettled(
          list.map(async r => {
            try { hMap[r.id] = await codebusterApi.getRepoHealth(r.id); }
            catch { /* skip */ }
          })
        );
        setRepoHealth(hMap);

        // Auto-scan first repo that has a review
        const first = list.find(r => hMap[r.id]?.latest_review_id);
        if (first) _startScan(first.id, hMap[first.id]);
      } catch (e) {
        setError(e?.message || 'Failed to load repositories');
      } finally {
        setLoadingRepos(false);
      }
    })();
  }, []);

  // ── Core scan starter (also called on repo click) ────────
  const _startScan = useCallback(async (repoId, health) => {
    setActiveRepoId(repoId);
    setLoadingReview(true);
    setScanning(false);
    setComplete(false);
    setFileIndex(0);
    setCurrentLine(0);
    setFileIssues({});
    setAllIssues([]);
    setFileData({});
    setFileTree([]);
    setScanQueue([]);
    setRepoScore(null);
    setRepoGrade(null);
    setReviewId(null);
    setDismissed(new Set());
    setError(null);
    discoveredRef.current.clear();
    if (viewerRef.current) viewerRef.current.scrollTop = 0;

    try {
      const reviewId = health?.latest_review_id;
      if (!reviewId) throw new Error('No review available for this repository');

      const review = await codebusterApi.getReview(reviewId);
      setRepoScore(review.overall_score ?? null);
      setRepoGrade(review.overall_grade ?? null);
      setReviewId(reviewId);

      const { fileData: fd, fileTree: ft, scanQueue: sq } = buildScanData(review.findings);

      if (!sq.length) throw new Error('No findings with file locations in this review');

      setFileData(fd);
      setFileTree(ft);
      setScanQueue(sq);
      setScanning(true);
    } catch (e) {
      setError(e?.message || 'Failed to load review');
    } finally {
      setLoadingReview(false);
    }
  }, []);

  const handleSelectRepo = useCallback((repoId) => {
    const h = repoHealth[repoId];
    if (h?.latest_review_id) _startScan(repoId, h);
  }, [repoHealth, _startScan]);

  const handleRestart = useCallback(() => {
    if (activeRepoId && repoHealth[activeRepoId]) {
      _startScan(activeRepoId, repoHealth[activeRepoId]);
    }
  }, [activeRepoId, repoHealth, _startScan]);

  // ── Dismiss a finding as inaccurate ─────────────────────
  const dismissFinding = useCallback(async (findingId, displayKey) => {
    setDismissed(prev => new Set([...prev, displayKey]));
    if (!findingId || !reviewId) return;
    try {
      await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ issue_id: findingId, review_id: reviewId, action: 'ignore', comment: 'Marked as inaccurate from X-Ray scanner' }),
      });
    } catch { /* fire-and-forget */ }
  }, [reviewId]);

  // ── Scanning engine ──────────────────────────────────────
  const fileName  = scanQueue[fileIndex];
  const fileDatum = fileName ? fileData[fileName] : null;

  useEffect(() => {
    if (!scanning || complete || !fileDatum) return;

    const { lines, isEllipsis, issues } = fileDatum;

    if (currentLine >= lines.length) {
      if (fileIndex < scanQueue.length - 1) {
        const t = setTimeout(() => {
          setFileIndex(i => i + 1);
          setCurrentLine(0);
          setFileIssues({});
          if (viewerRef.current) viewerRef.current.scrollTop = 0;
        }, FILE_SWITCH_DELAY);
        return () => clearTimeout(t);
      }
      setScanning(false);
      setComplete(true);
      return;
    }

    // Zip past ellipsis rows
    if (isEllipsis[currentLine]) {
      const t = setTimeout(() => setCurrentLine(n => n + 1), ELLIPSIS_SKIP_MS);
      return () => clearTimeout(t);
    }

    const displayNum = currentLine + 1;
    const issue      = issues[displayNum];
    const key        = `${fileName}:${displayNum}`;

    if (issue && !discoveredRef.current.has(key)) {
      discoveredRef.current.add(key);
      setFileIssues(prev => ({ ...prev, [displayNum]: issue }));
      setAllIssues(prev => [...prev, { ...issue, file: fileName, lineNum: fileDatum.lineNums[currentLine] ?? displayNum }]);
    }

    const delay = issue ? SCAN_SPEED_MS * ISSUE_PAUSE_MULT : SCAN_SPEED_MS;
    const t = setTimeout(() => setCurrentLine(n => n + 1), delay);
    return () => clearTimeout(t);
  }, [currentLine, scanning, complete, fileIndex, fileDatum, fileName, scanQueue.length]);

  // ── Auto-scroll to keep laser visible ───────────────────
  useEffect(() => {
    const el     = lineRefs.current[currentLine];
    const viewer = viewerRef.current;
    if (!el || !viewer) return;
    const target = el.offsetTop - viewer.clientHeight / 2 + LINE_HEIGHT;
    if (target > 0) viewer.scrollTo({ top: target, behavior: 'smooth' });
  }, [currentLine]);

  // ── Derived stats ────────────────────────────────────────
  const totalLines = scanQueue.reduce((s, f) => s + (fileData[f]?.lines.length || 0), 0);
  const scannedLines = scanQueue
    .slice(0, fileIndex)
    .reduce((s, f) => s + (fileData[f]?.lines.length || 0), 0) + currentLine;
  const progress = totalLines > 0 ? Math.min(100, Math.round((scannedLines / totalLines) * 100)) : 0;

  const critCount = allIssues.filter(i => i.severity === 'critical').length;
  const warnCount = allIssues.filter(i => i.severity === 'warning').length;
  const infoCount = allIssues.filter(i => i.severity === 'info').length;

  const activeRepo = repos.find(r => r.id === activeRepoId);
  const isLoading  = loadingRepos || loadingReview;

  return (
    <div className="xrs">

      {/* ── Header ───────────────────────────────────────── */}
      <header className="xrs-header">
        <div className="xrs-brand">
          <span className="xrs-brand-mark">◈</span>
          <span className="xrs-brand-name">X·RAY</span>
          {activeRepo && (
            <span className="xrs-brand-repo">
              {activeRepo.full_name}
              {repoGrade && (
                <span className="xrs-header-grade" style={{ borderColor: gradeColor(repoGrade), color: gradeColor(repoGrade) }}>
                  {repoGrade}
                </span>
              )}
            </span>
          )}
        </div>

        <div className="xrs-counters">
          <div className="xrs-counter xrs-counter--crit">
            <span className="xrs-counter-val">{critCount}</span>
            <span className="xrs-counter-lbl">CRITICAL</span>
          </div>
          <div className="xrs-counter xrs-counter--warn">
            <span className="xrs-counter-val">{warnCount}</span>
            <span className="xrs-counter-lbl">WARNINGS</span>
          </div>
          <div className="xrs-counter xrs-counter--info">
            <span className="xrs-counter-val">{infoCount}</span>
            <span className="xrs-counter-lbl">INFO</span>
          </div>
        </div>

        <div className="xrs-status-zone">
          {scanQueue.length > 0 && (
            <div className="xrs-progress-track">
              <div className="xrs-progress-fill" style={{ width: `${progress}%` }} />
              <span className="xrs-progress-pct">{progress}%</span>
            </div>
          )}
          {scanning && <span className="xrs-pulse" />}
          {complete ? (
            <button className="xrs-rescan-btn" onClick={handleRestart}>↺ RESCAN</button>
          ) : (
            <span className={`xrs-badge${scanning ? ' xrs-badge--live' : isLoading ? ' xrs-badge--loading' : ''}`}>
              {isLoading ? 'LOADING…' : scanning ? 'SCANNING' : 'IDLE'}
            </span>
          )}
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="xrs-body">

        {/* Left sidebar */}
        <aside className="xrs-sidebar">

          {/* Repos */}
          <div className="xrs-sidebar-section">
            <div className="xrs-sidebar-label">
              <span>REPOSITORIES</span>
              {!loadingRepos && <span className="xrs-sidebar-count">{repos.length}</span>}
            </div>
            <RepoList
              repos={repos}
              health={repoHealth}
              activeRepoId={activeRepoId}
              loading={loadingRepos}
              onSelect={handleSelectRepo}
            />
          </div>

          {/* File tree (shows once a repo is loaded) */}
          {(fileTree.length > 0 || loadingReview) && (
            <div className="xrs-sidebar-section xrs-sidebar-section--tree">
              <div className="xrs-sidebar-label">
                <span>SCAN QUEUE</span>
                {scanQueue.length > 0 && <span className="xrs-sidebar-count">{scanQueue.length} files</span>}
              </div>
              {loadingReview ? (
                <div className="xrs-loading-hint">
                  <span className="xrs-spin-sm">◌</span> loading…
                </div>
              ) : (
                <FileTree nodes={fileTree} activeFile={fileName} />
              )}
            </div>
          )}

          {/* Agent log */}
          {allIssues.length > 0 && (
            <div className="xrs-log">
              <div className="xrs-log-label">AGENT LOG</div>
              {allIssues.slice(-AGENT_LOG_MAX).map((iss, i) => (
                <div key={i} className={`xrs-log-entry xrs-log-entry--${iss.severity}`}>
                  <span className="xrs-log-icon">{SEV[iss.severity].icon}</span>
                  <span className="xrs-log-text">
                    {iss.file.split('/').pop()}:{iss.lineNum}
                  </span>
                </div>
              ))}
              {scanning && (
                <div className="xrs-log-cursor">
                  <span className="xrs-log-blink">▋</span>
                  <span className="xrs-log-scanning-text">
                    line {fileDatum?.lineNums[currentLine] ?? currentLine + 1}…
                  </span>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Right: code viewer */}
        <main className="xrs-main">
          {error ? (
            <div className="xrs-state-panel xrs-state--error">
              <span className="xrs-state-icon">✕</span>
              <span className="xrs-state-title">Error</span>
              <span className="xrs-state-sub">{error}</span>
            </div>
          ) : loadingReview ? (
            <div className="xrs-state-panel">
              <span className="xrs-state-icon xrs-spin">◈</span>
              <span className="xrs-state-title">Loading review…</span>
              <span className="xrs-state-sub">Fetching findings from backend</span>
            </div>
          ) : !fileDatum ? (
            <div className="xrs-state-panel">
              <span className="xrs-state-icon">◈</span>
              <span className="xrs-state-title">
                {loadingRepos ? 'Connecting…' : repos.length === 0 ? 'No repositories' : 'Select a repository'}
              </span>
              <span className="xrs-state-sub">
                {loadingRepos
                  ? 'Loading your repositories from the backend'
                  : 'Click any repository on the left to start the X-Ray scan'}
              </span>
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div className="xrs-tabs">
                {scanQueue.map((f, i) => (
                  <div
                    key={f}
                    className={`xrs-tab${i === fileIndex ? ' xrs-tab--active' : ''}${i < fileIndex ? ' xrs-tab--done' : ''}`}
                    title={f}
                  >
                    {i < fileIndex && <span className="xrs-tab-check">✓</span>}
                    <span>{f.split('/').pop()}</span>
                  </div>
                ))}
                <div className="xrs-tabs-spacer" />
                <span className="xrs-lang-pill">{fileDatum.language}</span>
              </div>

              {/* Code viewer */}
              <div className="xrs-viewer" ref={viewerRef}>
                {scanning && (
                  <div
                    className="xrs-laser"
                    style={{ transform: `translateY(${currentLine * LINE_HEIGHT + LASER_Y_OFFSET}px)` }}
                  />
                )}

                <div className="xrs-code-block">
                  {fileDatum.lines.map((line, idx) => {
                    const isEll      = fileDatum.isEllipsis[idx];
                    const realLn     = fileDatum.lineNums[idx];
                    const displayNum = idx + 1;
                    const issue      = fileIssues[displayNum];
                    const isActive   = currentLine === idx && scanning && !isEll;
                    const sev        = issue ? SEV[issue.severity] : null;

                    if (isEll) {
                      return (
                        <div key={`e-${idx}`} className="xrs-ellipsis-row" style={{ height: LINE_HEIGHT }}>
                          <span className="xrs-gutter">
                            <span className="xrs-gutter-num" style={{ opacity: 0.25 }}>·</span>
                          </span>
                          <span className="xrs-ellipsis-dots">···</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`${fileName}-${idx}`}
                        ref={el => (lineRefs.current[idx] = el)}
                        className={[
                          'xrs-line',
                          isActive ? 'xrs-line--active'            : '',
                          issue    ? `xrs-line--${issue.severity}` : '',
                        ].filter(Boolean).join(' ')}
                        style={{ height: LINE_HEIGHT }}
                      >
                        <span className="xrs-gutter">
                          {issue
                            ? <span className="xrs-gutter-pip" style={{ color: sev.color }}>{sev.icon}</span>
                            : <span className="xrs-gutter-num">{realLn ?? displayNum}</span>
                          }
                        </span>
                        <span
                          className="xrs-code-text"
                          dangerouslySetInnerHTML={{ __html: highlight(line) }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Floating tooltip annotations */}
                {Object.entries(fileIssues).map(([dn, issue]) => {
                  const idx        = parseInt(dn, 10) - 1;
                  const sev        = SEV[issue.severity];
                  const dispKey    = `${fileName}:${dn}`;
                  const isDismissed = dismissed.has(dispKey);

                  return (
                    <div
                      key={`tip-${dn}`}
                      className={`xrs-tooltip xrs-tooltip--${issue.severity}${isDismissed ? ' xrs-tooltip--dismissed' : ''}`}
                      style={{ top: idx * LINE_HEIGHT + LASER_Y_OFFSET }}
                    >
                      <div className="xrs-tip-header">
                        <span className="xrs-tip-badge" style={{ background: isDismissed ? '#444' : sev.color }}>
                          {isDismissed ? '✓ DISMISSED' : `${sev.icon} ${sev.label}`}
                        </span>
                        {issue.category && !isDismissed && (
                          <span className="xrs-tip-category">{issue.category}</span>
                        )}
                        <button
                          className="xrs-tip-dismiss"
                          title={isDismissed ? 'Dismissed as inaccurate' : 'Mark as inaccurate'}
                          disabled={isDismissed}
                          onClick={() => dismissFinding(issue.id, dispKey)}
                        >
                          {isDismissed ? '↩' : '✕ inaccurate'}
                        </button>
                      </div>
                      {!isDismissed && (
                        <span className="xrs-tip-text">{issue.message}</span>
                      )}
                    </div>
                  );
                })}

                {/* Scan complete banner */}
                {complete && (
                  <div className="xrs-complete">
                    <span className="xrs-complete-glyph">◈</span>
                    <span className="xrs-complete-title">ANALYSIS COMPLETE</span>
                    <span className="xrs-complete-sub">
                      {allIssues.length} issue{allIssues.length !== 1 ? 's' : ''} ·{' '}
                      {scanQueue.length} file{scanQueue.length !== 1 ? 's' : ''} ·{' '}
                      {activeRepo?.full_name}
                    </span>
                    {repoScore != null && (
                      <span className="xrs-complete-score">
                        Health score:{' '}
                        <strong style={{ color: gradeColor(repoGrade) }}>
                          {Math.round(repoScore)}
                        </strong>
                        {repoGrade && (
                          <span
                            className="xrs-header-grade"
                            style={{ borderColor: gradeColor(repoGrade), color: gradeColor(repoGrade) }}
                          >
                            {repoGrade}
                          </span>
                        )}
                      </span>
                    )}
                    <div className="xrs-complete-breakdown">
                      {critCount > 0 && <span className="xrs-bd-crit">{critCount} Critical</span>}
                      {warnCount > 0 && <span className="xrs-bd-warn">{warnCount} Warning</span>}
                      {infoCount > 0 && <span className="xrs-bd-info">{infoCount} Info</span>}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
