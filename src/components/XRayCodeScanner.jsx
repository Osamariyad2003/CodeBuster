import React, { useState, useEffect, useRef } from 'react';
import './XRayCodeScanner.css';

// ── MOCK DATA ─────────────────────────────────────────────────────────────────

const FILE_TREE = [
  {
    name: 'src', type: 'folder',
    children: [
      { name: 'App.jsx', type: 'file', ext: 'jsx' },
      { name: 'index.js', type: 'file', ext: 'js' },
      {
        name: 'components', type: 'folder',
        children: [
          { name: 'AuthManager.js', type: 'file', ext: 'js' },
          { name: 'DataFetcher.jsx', type: 'file', ext: 'jsx' },
          { name: 'UserStore.ts', type: 'file', ext: 'ts' },
        ],
      },
      {
        name: 'utils', type: 'folder',
        children: [
          { name: 'api.js', type: 'file', ext: 'js' },
          { name: 'helpers.ts', type: 'file', ext: 'ts' },
        ],
      },
    ],
  },
  { name: 'package.json', type: 'file', ext: 'json' },
  { name: '.env', type: 'file', ext: 'env' },
];

const MOCK_FILES = {
  'AuthManager.js': {
    language: 'JavaScript',
    lines: [
      "import { createHash } from 'crypto';",
      "import { db } from '../database/connection';",
      "import { UserSession } from './UserStore';",
      "",
      "class AuthManager {",
      "  constructor() {",
      "    this.sessions = {};",
      "    this.secretKey = process.env.SECRET_KEY;",
      "  }",
      "",
      "  async authenticate(username, password) {",
      "    const user = await db.query(",
      "      `SELECT * FROM users WHERE username = '${username}'`",
      "    );",
      "",
      "    if (!user) return null;",
      "",
      "    const hash = createHash('md5')",
      "      .update(password)",
      "      .digest('hex');",
      "",
      "    if (user.password === hash) {",
      "      const token = Math.random().toString(36);",
      "      this.sessions[token] = {",
      "        userId: user.id,",
      "        createdAt: Date.now(),",
      "      };",
      "      return token;",
      "    }",
      "    return null;",
      "  }",
      "",
      "  async revokeSession(token) {",
      "    delete this.sessions[token];",
      "  }",
      "",
      "  getActiveSessions() {",
      "    return Object.keys(this.sessions).length;",
      "  }",
      "}",
      "",
      "export default new AuthManager();",
    ],
    issues: {
      13: {
        severity: 'critical',
        message: "SQL Injection. String interpolation in query allows arbitrary SQL. Use parameterized queries: db.query('...WHERE username = ?', [username])",
      },
      18: {
        severity: 'critical',
        message: "MD5 is cryptographically broken. Never use for passwords. Replace with bcrypt or argon2id immediately.",
      },
      23: {
        severity: 'warning',
        message: "Math.random() is not cryptographically secure for session tokens. Use crypto.randomBytes(32).toString('hex') instead.",
      },
    },
  },
  'api.js': {
    language: 'JavaScript',
    lines: [
      "const BASE_URL = 'https://api.example.com/v2';",
      "",
      "let requestCache = {};",
      "let pendingRequests = {};",
      "",
      "export async function fetchUser(userId) {",
      "  if (requestCache[userId]) {",
      "    return requestCache[userId];",
      "  }",
      "",
      "  if (pendingRequests[userId]) {",
      "    return pendingRequests[userId];",
      "  }",
      "",
      "  pendingRequests[userId] = fetch(`${BASE_URL}/users/${userId}`)",
      "    .then(res => res.json())",
      "    .then(data => {",
      "      requestCache[userId] = data;",
      "      delete pendingRequests[userId];",
      "      return data;",
      "    });",
      "",
      "  return pendingRequests[userId];",
      "}",
      "",
      "export async function updateUser(userId, payload) {",
      "  const response = await fetch(`${BASE_URL}/users/${userId}`, {",
      "    method: 'PUT',",
      "    body: JSON.stringify(payload),",
      "  });",
      "",
      "  requestCache = {};",
      "  return response.json();",
      "}",
      "",
      "export function clearCache() {",
      "  requestCache = {};",
      "  pendingRequests = {};",
      "}",
    ],
    issues: {
      3: {
        severity: 'warning',
        message: "Module-level mutable state. In SSR environments this cache persists across requests — potential data leak between users.",
      },
      15: {
        severity: 'warning',
        message: "Race condition here. Multiple simultaneous fetchUser(id) calls will all bypass the pendingRequests guard before the first resolves.",
      },
      32: {
        severity: 'info',
        message: "Wiping entire cache on any update is wasteful. Consider targeted invalidation by userId to avoid unnecessary refetches.",
      },
    },
  },
};

const FILES_TO_SCAN    = ['AuthManager.js', 'api.js'];
const LINE_HEIGHT      = 22;
const SCAN_SPEED_MS    = 85;
const ISSUE_PAUSE_MULT = 6;
const TOTAL_LINES      = FILES_TO_SCAN.reduce((s, f) => s + MOCK_FILES[f].lines.length, 0);

// ── SEVERITY META ─────────────────────────────────────────────────────────────

const SEV = {
  critical: { label: 'CRITICAL', icon: '⚠', color: '#FF0055' },
  warning:  { label: 'WARN',     icon: '◉', color: '#FFB800' },
  info:     { label: 'INFO',     icon: 'ℹ', color: '#00F0FF' },
};

// ── SYNTAX HIGHLIGHTER ────────────────────────────────────────────────────────

function highlight(raw) {
  if (!raw || !raw.trim()) return ' ';
  const esc = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .replace(/(\/\/[^\n]*)$/gm,      '<span class="tok-cmt">$1</span>')
    .replace(/(`[^`]*`)/g,           '<span class="tok-tmpl">$1</span>')
    .replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, '<span class="tok-str">$1</span>')
    .replace(/\b(import|export|from|const|let|var|function|async|await|return|if|else|new|this|class|delete|null|undefined|true|false|typeof|default)\b/g, '<span class="tok-kw">$1</span>')
    .replace(/\b(\d+)\b/g,           '<span class="tok-num">$1</span>');
}

// ── FILE TREE ─────────────────────────────────────────────────────────────────

const EXT_META = {
  js:   { color: '#F7DF1E' },
  jsx:  { color: '#61DAFB' },
  ts:   { color: '#3178C6' },
  tsx:  { color: '#61DAFB' },
  json: { color: '#9CA3AF' },
  env:  { color: '#F87171' },
};

function FileTreeNode({ node, activeFile, depth }) {
  const [open, setOpen] = useState(true);
  const indent = depth * 14 + 10;

  if (node.type === 'folder') {
    return (
      <li className="ft-item">
        <button className="ft-folder" onClick={() => setOpen(o => !o)} style={{ paddingLeft: indent }}>
          <span className="ft-chevron">{open ? '▾' : '▸'}</span>
          <span className="ft-folder-icon">⊟</span>
          <span className="ft-name">{node.name}</span>
        </button>
        {open && node.children && (
          <ul className="ft-list">
            {node.children.map(c => (
              <FileTreeNode key={c.name} node={c} activeFile={activeFile} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const meta    = EXT_META[node.ext] || EXT_META.js;
  const isActive = node.name === activeFile;

  return (
    <li className={`ft-item ft-file${isActive ? ' ft-file--active' : ''}`}>
      <div className="ft-file-row" style={{ paddingLeft: indent }}>
        <span className="ft-file-dot" style={{ background: meta.color }} />
        <span className="ft-file-name">{node.name}</span>
        {isActive && <span className="ft-scanning-badge">ACTIVE</span>}
      </div>
    </li>
  );
}

function FileTree({ nodes, activeFile }) {
  return (
    <ul className="ft-list ft-root">
      {nodes.map(n => (
        <FileTreeNode key={n.name} node={n} activeFile={activeFile} depth={0} />
      ))}
    </ul>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function XRayCodeScanner() {
  const [fileIndex,    setFileIndex]    = useState(0);
  const [currentLine,  setCurrentLine]  = useState(0);
  const [fileIssues,   setFileIssues]   = useState({});
  const [allIssues,    setAllIssues]    = useState([]);
  const [scanning,     setScanning]     = useState(true);
  const [complete,     setComplete]     = useState(false);

  const viewerRef   = useRef(null);
  const lineRefs    = useRef([]);
  const discoveredRef = useRef(new Set());

  const fileName = FILES_TO_SCAN[fileIndex];
  const fileData = MOCK_FILES[fileName];

  // ── Scanning engine ──────────────────────────────────────
  useEffect(() => {
    if (!scanning || complete) return;

    const lines = fileData.lines;

    if (currentLine >= lines.length) {
      if (fileIndex < FILES_TO_SCAN.length - 1) {
        const t = setTimeout(() => {
          setFileIndex(i => i + 1);
          setCurrentLine(0);
          setFileIssues({});
        }, 1000);
        return () => clearTimeout(t);
      }
      setScanning(false);
      setComplete(true);
      return;
    }

    const lineNum = currentLine + 1;
    const issue   = fileData.issues[lineNum];
    const key     = `${fileName}:${lineNum}`;

    if (issue && !discoveredRef.current.has(key)) {
      discoveredRef.current.add(key);
      setFileIssues(prev => ({ ...prev, [lineNum]: issue }));
      setAllIssues(prev => [...prev, { ...issue, file: fileName, lineNum }]);
    }

    const delay = issue ? SCAN_SPEED_MS * ISSUE_PAUSE_MULT : SCAN_SPEED_MS;
    const t = setTimeout(() => setCurrentLine(n => n + 1), delay);
    return () => clearTimeout(t);
  }, [currentLine, scanning, complete, fileIndex]);

  // ── Auto-scroll ──────────────────────────────────────────
  useEffect(() => {
    const el     = lineRefs.current[currentLine];
    const viewer = viewerRef.current;
    if (!el || !viewer) return;
    const elTop  = el.offsetTop;
    const center = elTop - viewer.clientHeight / 2 + LINE_HEIGHT;
    if (center > 0) viewer.scrollTop = center;
  }, [currentLine]);

  const restart = () => {
    discoveredRef.current.clear();
    setFileIndex(0);
    setCurrentLine(0);
    setFileIssues({});
    setAllIssues([]);
    setScanning(true);
    setComplete(false);
    if (viewerRef.current) viewerRef.current.scrollTop = 0;
  };

  // ── Derived stats ────────────────────────────────────────
  const linesScanned = FILES_TO_SCAN
    .slice(0, fileIndex)
    .reduce((s, f) => s + MOCK_FILES[f].lines.length, 0) + currentLine;
  const progress = Math.min(100, Math.round((linesScanned / TOTAL_LINES) * 100));

  const critCount = allIssues.filter(i => i.severity === 'critical').length;
  const warnCount = allIssues.filter(i => i.severity === 'warning').length;
  const infoCount = allIssues.filter(i => i.severity === 'info').length;

  return (
    <div className="xrs">

      {/* ── Top header bar ───────────────────────────────── */}
      <header className="xrs-header">
        <div className="xrs-brand">
          <span className="xrs-brand-mark">◈</span>
          <span className="xrs-brand-name">X·RAY</span>
          <span className="xrs-brand-sub">AI Static Analysis</span>
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
          <div className="xrs-progress-track">
            <div className="xrs-progress-fill" style={{ width: `${progress}%` }} />
            <span className="xrs-progress-pct">{progress}%</span>
          </div>
          {scanning && <span className="xrs-pulse" />}
          {complete ? (
            <button className="xrs-rescan-btn" onClick={restart}>↺ RESCAN</button>
          ) : (
            <span className={`xrs-badge${scanning ? ' xrs-badge--live' : ''}`}>
              {scanning ? 'SCANNING' : 'IDLE'}
            </span>
          )}
        </div>
      </header>

      {/* ── Main split layout ────────────────────────────── */}
      <div className="xrs-body">

        {/* Left sidebar: file tree */}
        <aside className="xrs-sidebar">
          <div className="xrs-sidebar-label">
            <span>REPOSITORY</span>
            <span className="xrs-sidebar-count">{FILES_TO_SCAN.length} FILES QUEUED</span>
          </div>
          <FileTree nodes={FILE_TREE} activeFile={fileName} />

          {/* Scan log */}
          <div className="xrs-log">
            <div className="xrs-log-label">AGENT LOG</div>
            {allIssues.slice(-6).map((iss, i) => (
              <div key={i} className={`xrs-log-entry xrs-log-entry--${iss.severity}`}>
                <span className="xrs-log-icon">{SEV[iss.severity].icon}</span>
                <span className="xrs-log-text">{iss.file}:{iss.lineNum}</span>
              </div>
            ))}
            {scanning && (
              <div className="xrs-log-cursor">
                <span className="xrs-log-blink">▋</span>
                <span className="xrs-log-scanning-text">reading line {currentLine + 1}…</span>
              </div>
            )}
          </div>
        </aside>

        {/* Right pane: code viewer */}
        <main className="xrs-main">
          {/* Tab bar */}
          <div className="xrs-tabs">
            {FILES_TO_SCAN.map((f, i) => (
              <div
                key={f}
                className={`xrs-tab${i === fileIndex ? ' xrs-tab--active' : ''}${i < fileIndex ? ' xrs-tab--done' : ''}`}
              >
                {i < fileIndex && <span className="xrs-tab-check">✓</span>}
                <span>{f}</span>
              </div>
            ))}
            <div className="xrs-tabs-spacer" />
            <span className="xrs-lang-pill">{fileData?.language}</span>
          </div>

          {/* Scrollable code area */}
          <div className="xrs-viewer" ref={viewerRef}>

            {/* Laser sweep line */}
            {scanning && (
              <div
                className="xrs-laser"
                style={{ transform: `translateY(${currentLine * LINE_HEIGHT}px)` }}
              />
            )}

            {/* Code lines */}
            <div className="xrs-code-block">
              {fileData.lines.map((line, idx) => {
                const lineNum  = idx + 1;
                const issue    = fileIssues[lineNum];
                const isActive = currentLine === idx && scanning;
                const sev      = issue ? SEV[issue.severity] : null;

                return (
                  <div
                    key={`${fileName}-${lineNum}`}
                    ref={el => (lineRefs.current[idx] = el)}
                    className={[
                      'xrs-line',
                      isActive ? 'xrs-line--active' : '',
                      issue    ? `xrs-line--${issue.severity}` : '',
                    ].filter(Boolean).join(' ')}
                    style={{ height: LINE_HEIGHT }}
                  >
                    {/* Gutter */}
                    <span className="xrs-gutter">
                      {issue
                        ? <span className="xrs-gutter-pip" style={{ color: sev.color }}>{sev.icon}</span>
                        : <span className="xrs-gutter-num">{lineNum}</span>
                      }
                    </span>

                    {/* Code text */}
                    <span
                      className="xrs-code-text"
                      dangerouslySetInnerHTML={{ __html: highlight(line) }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Tooltip annotations layer (absolutely positioned) */}
            {Object.entries(fileIssues).map(([lineNum, issue]) => {
              const sev    = SEV[issue.severity];
              const topPx  = (parseInt(lineNum, 10) - 1) * LINE_HEIGHT;
              return (
                <div
                  key={`tip-${lineNum}`}
                  className={`xrs-tooltip xrs-tooltip--${issue.severity}`}
                  style={{ top: topPx }}
                >
                  <span className="xrs-tip-badge" style={{ background: sev.color }}>
                    {sev.icon} {sev.label}
                  </span>
                  <span className="xrs-tip-text">{issue.message}</span>
                </div>
              );
            })}

            {/* Scan complete overlay */}
            {complete && (
              <div className="xrs-complete">
                <span className="xrs-complete-glyph">◈</span>
                <span className="xrs-complete-title">ANALYSIS COMPLETE</span>
                <span className="xrs-complete-sub">
                  {allIssues.length} issue{allIssues.length !== 1 ? 's' : ''} found
                  across {FILES_TO_SCAN.length} files · {TOTAL_LINES} lines scanned
                </span>
                <div className="xrs-complete-breakdown">
                  {critCount > 0 && <span className="xrs-bd-crit">{critCount} Critical</span>}
                  {warnCount > 0 && <span className="xrs-bd-warn">{warnCount} Warning</span>}
                  {infoCount > 0 && <span className="xrs-bd-info">{infoCount} Info</span>}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
