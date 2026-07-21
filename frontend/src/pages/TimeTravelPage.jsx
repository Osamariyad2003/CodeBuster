import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { Dropdown } from 'react-bootstrap';
import {
  FaGithub, FaPlay, FaPause, FaStepBackward, FaStepForward,
  FaClock, FaCodeBranch,
  FaSearch, FaFile,
} from 'react-icons/fa';
import { apiClient } from '../lib/apiClient';

/* ─── Constants ───────────────────────────────────────────────────────── */
const SEV_ORDER = { critical: 0, major: 1, minor: 2, info: 3 };

const SEV = {
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', label: 'Critical' },
  major:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', label: 'Major'    },
  minor:    { color: '#818CF8', bg: 'rgba(129,140,248,0.10)', border: 'rgba(129,140,248,0.25)', label: 'Minor' },
  info:     { color: '#94A3B8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)', label: 'Info'   },
};

const GRADE_COLOR = { A: '#22C55E', B: '#84CC16', C: '#F59E0B', D: '#F97316', F: '#EF4444' };

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function gradeColor(g) { return GRADE_COLOR[g] || '#64748B'; }

function severityOf(issue) {
  const s = (issue.severity || 'info').toLowerCase();
  return SEV[s] ? s : 'info';
}

function issueKey(issue) {
  return `${issue.file || ''}-${issue.title}-${issue.line || 0}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function guessLang(filepath) {
  if (!filepath) return 'text';
  const ext = filepath.split('.').pop().toLowerCase();
  const map = { py: 'python', js: 'javascript', jsx: 'jsx', ts: 'typescript',
    tsx: 'tsx', go: 'go', java: 'java', rb: 'ruby', rs: 'rust', cs: 'csharp',
    cpp: 'cpp', c: 'c', sh: 'bash', yml: 'yaml', yaml: 'yaml', json: 'json',
    html: 'html', css: 'css', sql: 'sql', md: 'markdown' };
  return map[ext] || 'text';
}

/* ─── Grade badge ─────────────────────────────────────────────────────── */
function GradeBadge({ grade, size = 22 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: 4, fontSize: size * 0.5, fontWeight: 700,
      background: gradeColor(grade), color: '#fff', flexShrink: 0,
    }}>{grade || '?'}</span>
  );
}

/* ─── Animated issue card ─────────────────────────────────────────────── */
function IssueCard({ issue, state, delayMs = 0 }) {
  const s = SEV[severityOf(issue)] || SEV.info;
  const lang = guessLang(issue.file);
  const snippet = issue.code_snippet || '';

  return (
    <div
      className={`tt-issue tt-issue--${state}`}
      style={{ '--delay': `${delayMs}ms`, '--sev-color': s.color, '--sev-bg': s.bg, '--sev-border': s.border }}
    >
      <div className="tt-issue__header">
        <span className="tt-issue__badge">{s.label}</span>
        <span className="tt-issue__title">{issue.title}</span>
        {issue.line && <span className="tt-issue__line">:{issue.line}</span>}
      </div>

      {snippet ? (
        <div className="tt-issue__code">
          <SyntaxHighlighter
            language={lang}
            PreTag="div"
            CodeTag="code"
            style={prismTheme}
            customStyle={{
              background: 'rgba(0,0,0,0.35)', margin: 0, padding: '10px 14px',
              borderRadius: 6, fontSize: 12, lineHeight: 1.6,
              overflow: 'auto', maxHeight: 180,
            }}
            wrapLines={false}
            useInlineStyles
          >{snippet}</SyntaxHighlighter>
        </div>
      ) : (
        <div className="tt-issue__no-snippet">
          {issue.description || issue.ai_explanation || 'No code snippet available.'}
        </div>
      )}

      {issue.recommendation && (
        <div className="tt-issue__fix">
          <span className="tt-issue__fix-label">Fix:</span> {issue.recommendation}
        </div>
      )}
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────── */
function EmptyPane({ msg }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, opacity: 0.4 }}>
      <FaFile size={28} />
      <span style={{ fontSize: 13, color: '#94A3B8' }}>{msg}</span>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────── */
export default function TimeTravelPage() {
  const [searchParams] = useSearchParams();
  const initialRepoId = searchParams.get('repo');

  /* ─ Repo state ─ */
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);

  /* ─ Review timeline ─ */
  const [reviews, setReviews] = useState([]);    // oldest → newest
  const [reviewIdx, setReviewIdx] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(false);

  /* ─ Issues ─ */
  const issueCache = useRef({});  // review_id → Issue[]
  const [currentIssues, setCurrentIssues] = useState([]);
  const [prevIssues, setPrevIssues] = useState([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

  /* ─ File selection ─ */
  const [allFiles, setAllFiles] = useState([]);   // union of files seen
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileSearch, setFileSearch] = useState('');

  /* ─ Animation ─ */
  const [displayItems, setDisplayItems] = useState([]);  // { issue, state }
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimer = useRef(null);

  /* ─ Playback ─ */
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimer = useRef(null);

  /* ─ Timeline drag ─ */
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef(null);

  /* ─── Load repos ────────────────────────────────────────────────────── */
  useEffect(() => {
    apiClient.get('/api/repos').then(res => {
      const list = res?.repos ?? (Array.isArray(res) ? res : []);
      setRepos(list);
      if (list.length > 0) {
        const pre = initialRepoId ? list.find(r => r.id === initialRepoId) : null;
        setSelectedRepo(pre || list[0]);
      }
    }).catch(() => setRepos([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Load reviews when repo changes ───────────────────────────────── */
  useEffect(() => {
    if (!selectedRepo) return;
    setReviews([]);
    setReviewIdx(0);
    setCurrentIssues([]);
    setPrevIssues([]);
    setDisplayItems([]);
    setAllFiles([]);
    setSelectedFile(null);
    issueCache.current = {};
    setLoadingReviews(true);

    apiClient.get(`/api/repos/${selectedRepo.id}/reviews?limit=50`).then(res => {
      const list = (res?.reviews ?? []).reverse(); // oldest → newest
      setReviews(list);
      setLoadingReviews(false);
      if (list.length > 0) setReviewIdx(list.length - 1); // start at latest
    }).catch(() => setLoadingReviews(false));
  }, [selectedRepo]);

  /* ─── Load issues for a review ─────────────────────────────────────── */
  const loadIssues = useCallback(async (review) => {
    if (!review || !selectedRepo) return [];
    if (issueCache.current[review.id]) return issueCache.current[review.id];

    try {
      const res = await apiClient.get(`/api/repos/${selectedRepo.id}/reviews/${review.id}/issues?limit=150`);
      const issues = res?.issues ?? [];
      issueCache.current[review.id] = issues;

      // Accumulate all unique file paths we've seen
      setAllFiles(prev => {
        const set = new Set(prev);
        issues.forEach(i => { if (i.file) set.add(i.file); });
        return [...set].sort();
      });

      return issues;
    } catch {
      return [];
    }
  }, [selectedRepo]);

  /* ─── Animate transition between review states ──────────────────────── */
  const animateTransition = useCallback((incoming, outgoing) => {
    clearTimeout(transitionTimer.current);
    setIsTransitioning(true);

    const prevKeys = new Set(outgoing.map(issueKey));
    const nextKeys = new Set(incoming.map(issueKey));

    // Phase 1: mark outgoing as exiting
    const exitItems = outgoing
      .filter(i => !nextKeys.has(issueKey(i)))
      .map((issue, idx) => ({ issue, state: 'exiting', delay: idx * 35 }));

    const stableItems = outgoing
      .filter(i => nextKeys.has(issueKey(i)))
      .map(issue => ({ issue, state: 'stable', delay: 0 }));

    setDisplayItems([...stableItems, ...exitItems]);

    transitionTimer.current = setTimeout(() => {
      // Phase 2: bring in entering items
      const enterItems = incoming
        .filter(i => !prevKeys.has(issueKey(i)))
        .map((issue, idx) => ({ issue, state: 'entering', delay: idx * 45 }));

      const newStable = incoming
        .filter(i => prevKeys.has(issueKey(i)))
        .map(issue => ({ issue, state: 'stable', delay: 0 }));

      setDisplayItems([...newStable, ...enterItems]);
      setIsTransitioning(false);

      transitionTimer.current = setTimeout(() => {
        setDisplayItems(prev => prev.map(d => ({ ...d, state: 'stable', delay: 0 })));
      }, 600);
    }, 350);
  }, []);

  /* ─── React to reviewIdx changes ────────────────────────────────────── */
  useEffect(() => {
    if (reviews.length === 0) return;
    const review = reviews[reviewIdx];
    if (!review) return;

    setLoadingIssues(true);

    const prevReview = reviews[reviewIdx - 1];
    Promise.all([
      loadIssues(review),
      prevReview ? loadIssues(prevReview) : Promise.resolve([]),
    ]).then(([curr, prev]) => {
      const currFiltered = selectedFile ? curr.filter(i => i.file === selectedFile) : curr;
      const prevFiltered = selectedFile ? prev.filter(i => i.file === selectedFile) : prev;

      setCurrentIssues(currFiltered);
      setPrevIssues(prevFiltered);
      animateTransition(currFiltered, prevFiltered);
      setLoadingIssues(false);
    });
  }, [reviewIdx, reviews, selectedFile, loadIssues, animateTransition]);

  /* ─── Autoplay ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (isPlaying) {
      playTimer.current = setInterval(() => {
        setReviewIdx(prev => {
          if (prev >= reviews.length - 1) { setIsPlaying(false); return prev; }
          return prev + 1;
        });
      }, 2500);
    }
    return () => clearInterval(playTimer.current);
  }, [isPlaying, reviews.length]);

  /* ─── Timeline drag ─────────────────────────────────────────────────── */
  const handleTrackPointer = useCallback((e) => {
    if (!trackRef.current || reviews.length === 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(x * (reviews.length - 1));
    setReviewIdx(idx);
    setIsPlaying(false);
  }, [reviews.length]);

  useEffect(() => {
    const mm = (e) => { if (isDragging) handleTrackPointer(e); };
    const mu = () => setIsDragging(false);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
  }, [isDragging, handleTrackPointer]);

  /* ─── File selection ────────────────────────────────────────────────── */
  const filteredFiles = useMemo(() =>
    allFiles.filter(f => f.toLowerCase().includes(fileSearch.toLowerCase())),
    [allFiles, fileSearch]);

  const currentReview = reviews[reviewIdx];
  const pct = reviews.length > 1 ? (reviewIdx / (reviews.length - 1)) * 100 : 0;

  /* ─── Diff stats (new / fixed) ──────────────────────────────────────── */
  const diffStats = useMemo(() => {
    if (reviewIdx === 0 || prevIssues.length === 0 && currentIssues.length === 0) return null;
    const prevKeys = new Set(prevIssues.map(issueKey));
    const currKeys = new Set(currentIssues.map(issueKey));
    const added   = currentIssues.filter(i => !prevKeys.has(issueKey(i))).length;
    const fixed   = prevIssues.filter(i => !currKeys.has(issueKey(i))).length;
    return { added, fixed };
  }, [reviewIdx, currentIssues, prevIssues]);

  /* ─── Render ────────────────────────────────────────────────────────── */
  return (
    <div className="ai-reviews-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{CSS}</style>

      {/* ─ Header ─ */}
      <div className="tt-header">
        <div className="tt-header__left">
          <div className="tt-logo"><FaClock size={14} /></div>
          <span className="tt-title">Time Travel</span>
          {currentReview && (
            <div className="tt-header__review-pill">
              <GradeBadge grade={currentReview.grade} size={18} />
              <span>{currentReview.overall_health_score ?? '—'}</span>
              <span style={{ color: '#4B5563' }}>·</span>
              <span>{fmtDate(currentReview.created_at)}</span>
              {currentReview.branch && (
                <><span style={{ color: '#4B5563' }}>·</span><FaCodeBranch size={10} /><span>{currentReview.branch}</span></>
              )}
            </div>
          )}
          {diffStats && (
            <div className="tt-diff-stats">
              {diffStats.fixed > 0 && (
                <span className="tt-diff-stats__fixed">▼ {diffStats.fixed} fixed</span>
              )}
              {diffStats.added > 0 && (
                <span className="tt-diff-stats__added">▲ {diffStats.added} new</span>
              )}
              {diffStats.fixed === 0 && diffStats.added === 0 && (
                <span style={{ fontSize: 11, color: '#374151' }}>no change</span>
              )}
            </div>
          )}
        </div>
        <div className="tt-header__right">
          <Dropdown>
            <Dropdown.Toggle as="div" className="tt-repo-toggle">
              <FaGithub size={13} />
              <span>{selectedRepo?.name || selectedRepo?.full_name || 'Select Repository'}</span>
              <span className="tt-chevron">▾</span>
            </Dropdown.Toggle>
            <Dropdown.Menu className="tt-repo-menu">
              {repos.length === 0
                ? <div style={{ padding: '10px 14px', fontSize: 12, color: '#64748B' }}>No connected repos</div>
                : repos.map(r => (
                  <Dropdown.Item key={r.id} as="div" className="tt-repo-item" onClick={() => { setSelectedRepo(r); setIsPlaying(false); }}>
                    <FaGithub size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                    <span className="tt-repo-name">{r.name || r.full_name}</span>
                    <GradeBadge grade={r.overall_grade} size={20} />
                  </Dropdown.Item>
                ))
              }
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {/* ─ Body ─ */}
      {loadingReviews ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', fontSize: 14 }}>
          Loading review history…
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#4B5563' }}>
          <FaClock size={32} />
          <span style={{ fontSize: 14 }}>No reviews yet for this repository.</span>
          <span style={{ fontSize: 12 }}>Run a scan to populate the timeline.</span>
        </div>
      ) : (
        <div className="tt-body">

          {/* ─ Left: file tree ─ */}
          <div className="tt-sidebar">
            <div className="tt-sidebar__title">Files with Issues</div>
            <div className="tt-search-wrap">
              <FaSearch size={10} style={{ color: '#4B5563', flexShrink: 0 }} />
              <input
                className="tt-search"
                placeholder="Filter files…"
                value={fileSearch}
                onChange={e => setFileSearch(e.target.value)}
              />
            </div>
            <div className="tt-file-list">
              <button
                className={`tt-file-item${selectedFile === null ? ' active' : ''}`}
                onClick={() => setSelectedFile(null)}
              >
                <span className="tt-file-item__name" style={{ color: '#818CF8' }}>All files</span>
                <span className="tt-file-item__count">{currentIssues.length}</span>
              </button>
              {filteredFiles.map(f => {
                const fileIssues = currentIssues.filter(i => i.file === f);
                const hasNew = fileIssues.some(i => !prevIssues.find(p => issueKey(p) === issueKey(i)));
                return (
                  <button
                    key={f}
                    className={`tt-file-item${selectedFile === f ? ' active' : ''}`}
                    onClick={() => setSelectedFile(f)}
                  >
                    <span className="tt-file-item__name" title={f}>{f.split('/').pop()}</span>
                    {fileIssues.length > 0 && (
                      <span className="tt-file-item__count" style={{ background: hasNew ? 'rgba(239,68,68,0.2)' : undefined }}>
                        {fileIssues.length}
                      </span>
                    )}
                  </button>
                );
              })}
              {filteredFiles.length === 0 && allFiles.length > 0 && (
                <div style={{ padding: '8px 12px', fontSize: 11, color: '#374151' }}>No matches</div>
              )}
              {allFiles.length === 0 && (
                <div style={{ padding: '8px 12px', fontSize: 11, color: '#374151' }}>Loading files…</div>
              )}
            </div>
          </div>

          {/* ─ Right: issue viewer ─ */}
          <div className="tt-editor">
            <div className="tt-editor__header">
              <span className="tt-editor__file">
                {selectedFile ? selectedFile : 'All issues'}
              </span>
              <div className="tt-editor__meta">
                {currentIssues.length > 0 && (
                  <span className="tt-count-pill">{currentIssues.length} issue{currentIssues.length !== 1 ? 's' : ''}</span>
                )}
                {loadingIssues && <span style={{ fontSize: 11, color: '#4B5563' }}>Loading…</span>}
              </div>
            </div>

            <div className="tt-code-wrap">
              {displayItems.length === 0 && !loadingIssues && (
                <EmptyPane msg={reviews.length > 0 ? 'No issues in this review' : 'Select a repository'} />
              )}
              <div className="tt-issues-list">
                {displayItems.map(({ issue, state, delay }, i) => (
                  <IssueCard key={`${issueKey(issue)}-${i}`} issue={issue} state={state} delayMs={delay} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─ Timeline ─ */}
      {reviews.length > 0 && (
        <div className="tt-timeline">
          <div className="tt-timeline__controls">
            <button className="tt-ctrl-btn" onClick={() => { setReviewIdx(0); setIsPlaying(false); }} title="Rewind">
              <FaStepBackward size={10} />
            </button>
            <button className="tt-ctrl-btn" onClick={() => setReviewIdx(p => Math.max(0, p - 1))}>‹</button>
            <button className="tt-ctrl-btn tt-ctrl-btn--play" onClick={() => setIsPlaying(p => !p)}>
              {isPlaying ? <FaPause size={11} /> : <FaPlay size={11} />}
            </button>
            <button className="tt-ctrl-btn" onClick={() => setReviewIdx(p => Math.min(reviews.length - 1, p + 1))}>›</button>
            <button className="tt-ctrl-btn" onClick={() => { setReviewIdx(reviews.length - 1); setIsPlaying(false); }} title="Latest">
              <FaStepForward size={10} />
            </button>
          </div>

          <div className="tt-timeline__track-wrap">
            <div
              ref={trackRef}
              className="tt-track"
              onMouseDown={e => { setIsDragging(true); handleTrackPointer(e); }}
              onClick={handleTrackPointer}
            >
              <div className="tt-track__fill" style={{ width: `${pct}%` }} />

              {reviews.map((r, i) => {
                const p = reviews.length > 1 ? (i / (reviews.length - 1)) * 100 : 50;
                const c = gradeColor(r.grade);
                return (
                  <div
                    key={r.id}
                    className={`tt-dot${i === reviewIdx ? ' tt-dot--active' : ''}`}
                    style={{ left: `${p}%`, '--sev-color': c }}
                    onClick={e => { e.stopPropagation(); setReviewIdx(i); setIsPlaying(false); }}
                    title={`${fmtDate(r.created_at)} · Grade ${r.grade || '?'} · Score ${r.overall_health_score ?? '—'}`}
                  />
                );
              })}

              <div className="tt-playhead" style={{ left: `${pct}%` }} />
            </div>

            <div className="tt-dates">
              {reviews.map((r, i) => {
                const p = reviews.length > 1 ? (i / (reviews.length - 1)) * 100 : 50;
                return (
                  <span key={r.id} className={`tt-date-label${i === reviewIdx ? ' active' : ''}`} style={{ left: `${p}%` }}>
                    {fmtDate(r.created_at)}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="tt-timeline__info">
            {currentReview && (
              <>
                <span className="tt-info-sha">{currentReview.commit_sha?.slice(0, 8) || 'manual'}</span>
                <span className="tt-info-msg">{currentReview.trigger_source || currentReview.trigger_type || 'review'}</span>
                <span className="tt-info-pos">{reviewIdx + 1} / {reviews.length}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Custom Prism theme ─────────────────────────────────────────────── */
const prismTheme = {
  'code[class*="language-"]': { color: '#C9D1D9', background: 'none', fontFamily: "'JetBrains Mono', monospace" },
  'token comment': { color: '#8B949E', fontStyle: 'italic' },
  'token keyword': { color: '#FF7B72' },
  'token string': { color: '#A5D6FF' },
  'token number': { color: '#79C0FF' },
  'token function': { color: '#D2A8FF' },
  'token class-name': { color: '#FFA657' },
  'token operator': { color: '#79C0FF' },
  'token punctuation': { color: '#8B949E' },
  'token builtin': { color: '#79C0FF' },
};

/* ─── CSS ─────────────────────────────────────────────────────────────── */
const CSS = `
/* Fullscreen page wrapper — fills the content column edge-to-edge */
.ai-reviews-page {
  margin: 0 !important;
}

.tt-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; height: 52px; flex-shrink: 0;
  background: rgba(12,12,16,0.95); border-bottom: 1px solid rgba(129,140,248,0.12);
  backdrop-filter: blur(12px); gap: 16px;
}
.tt-header__left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.tt-header__right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.tt-logo {
  width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
  background: linear-gradient(135deg, #6366F1, #818CF8);
  display: flex; align-items: center; justify-content: center;
  color: #fff; box-shadow: 0 0 14px rgba(99,102,241,0.5);
}
.tt-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 15px; color: #E2E8F0; flex-shrink: 0; }

.tt-header__review-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 10px; border-radius: 20px;
  background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
  font-size: 11px; color: #94A3B8; overflow: hidden;
}

/* Repo dropdown */
.tt-repo-toggle {
  display: flex; align-items: center; gap: 8px; padding: 6px 12px;
  border-radius: 8px; cursor: pointer;
  background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25);
  color: #CBD5E1; font-size: 13px; transition: all 0.15s;
}
.tt-repo-toggle:hover { background: rgba(99,102,241,0.18); border-color: rgba(99,102,241,0.4); }
.tt-chevron { font-size: 10px; color: #64748B; }
.tt-repo-menu {
  background: #141419 !important; border: 1px solid rgba(99,102,241,0.2) !important;
  border-radius: 10px !important; padding: 6px !important;
  box-shadow: 0 16px 48px rgba(0,0,0,0.6) !important; min-width: 240px !important;
}
.tt-repo-item {
  display: flex !important; align-items: center; gap: 8px;
  padding: 8px 10px !important; border-radius: 7px !important;
  cursor: pointer; color: #CBD5E1 !important; transition: background 0.12s;
}
.tt-repo-item:hover { background: rgba(99,102,241,0.12) !important; }
.tt-repo-name { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Body */
.tt-body { flex: 1; display: flex; min-height: 0; overflow: hidden; }

/* Sidebar */
.tt-sidebar {
  width: 220px; flex-shrink: 0; display: flex; flex-direction: column;
  border-right: 1px solid rgba(129,140,248,0.1); background: rgba(8,8,12,0.6);
}
.tt-sidebar__title {
  padding: 10px 14px 6px; font-size: 10px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; color: #374151;
}
.tt-search-wrap {
  display: flex; align-items: center; gap: 6px;
  margin: 0 8px 6px; padding: 5px 8px; border-radius: 6px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
}
.tt-search {
  flex: 1; background: none; border: none; outline: none;
  color: #94A3B8; font-size: 11px; font-family: inherit;
}
.tt-search::placeholder { color: #374151; }

.tt-file-list { flex: 1; overflow-y: auto; padding: 0 6px 8px; }
.tt-file-list::-webkit-scrollbar { width: 3px; }
.tt-file-list::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 99px; }

.tt-file-item {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  gap: 6px; padding: 6px 8px; border-radius: 6px; border: 1px solid transparent;
  background: none; text-align: left; cursor: pointer; transition: all 0.12s;
  margin-bottom: 1px;
}
.tt-file-item:hover { background: rgba(99,102,241,0.08); }
.tt-file-item.active { background: rgba(99,102,241,0.14); border-color: rgba(99,102,241,0.3); }
.tt-file-item__name {
  flex: 1; font-size: 11.5px; color: #94A3B8; font-family: 'JetBrains Mono', monospace;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tt-file-item.active .tt-file-item__name { color: #C7D2FE; }
.tt-file-item__count {
  font-size: 10px; padding: 1px 5px; border-radius: 99px;
  background: rgba(99,102,241,0.15); color: #818CF8; flex-shrink: 0;
}

/* Editor */
.tt-editor { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.tt-editor__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 16px; border-bottom: 1px solid rgba(129,140,248,0.1);
  background: rgba(12,12,16,0.8); flex-shrink: 0;
}
.tt-editor__file { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #818CF8; }
.tt-editor__meta { display: flex; align-items: center; gap: 10px; }
.tt-count-pill {
  padding: 2px 8px; border-radius: 99px; font-size: 11px;
  background: rgba(99,102,241,0.15); color: #818CF8;
}
.tt-code-wrap { flex: 1; overflow-y: auto; padding: 12px; background: #09090E; position: relative; }
.tt-code-wrap::-webkit-scrollbar { width: 4px; }
.tt-code-wrap::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 99px; }
.tt-issues-list { display: flex; flex-direction: column; gap: 10px; }

/* Issue cards */
.tt-issue {
  border-radius: 8px; overflow: hidden;
  border: 1px solid var(--sev-border); background: var(--sev-bg);
}
.tt-issue--entering {
  animation: issueGlow 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: var(--delay, 0ms);
}
.tt-issue--exiting {
  animation: issueDissolve 0.3s ease-out forwards;
  animation-delay: var(--delay, 0ms);
  pointer-events: none;
}
@keyframes issueGlow {
  0%   { opacity: 0; transform: translateY(8px) scale(0.97); box-shadow: 0 0 20px var(--sev-color); }
  60%  { box-shadow: 0 0 12px var(--sev-color); }
  100% { opacity: 1; transform: translateY(0) scale(1); box-shadow: none; }
}
@keyframes issueDissolve {
  0%   { opacity: 1; transform: scaleY(1); filter: blur(0); }
  100% { opacity: 0; transform: scaleY(0.6); filter: blur(3px); max-height: 0; }
}

.tt-issue__header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px 6px; border-bottom: 1px solid rgba(255,255,255,0.05);
}
.tt-issue__badge {
  font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px;
  background: var(--sev-bg); color: var(--sev-color);
  border: 1px solid var(--sev-border); flex-shrink: 0; letter-spacing: 0.04em;
}
.tt-issue__title { flex: 1; font-size: 12.5px; color: #CBD5E1; font-weight: 500; min-width: 0; }
.tt-issue__line { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #4B5563; flex-shrink: 0; }
.tt-issue__code { padding: 6px 8px 8px; }
.tt-issue__no-snippet {
  padding: 8px 12px; font-size: 12px; color: #64748B; line-height: 1.5;
}
.tt-issue__fix {
  padding: 4px 12px 8px; font-size: 11px; color: #64748B;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.tt-issue__fix-label { color: #818CF8; font-weight: 600; }

/* Timeline */
.tt-timeline {
  flex-shrink: 0; height: 80px; display: flex; align-items: center; gap: 16px;
  padding: 0 20px; background: rgba(8,8,12,0.97);
  border-top: 1px solid rgba(129,140,248,0.12);
}
.tt-timeline__controls { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.tt-ctrl-btn {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; border: none; background: rgba(99,102,241,0.1);
  color: #64748B; cursor: pointer; transition: all 0.15s; font-size: 14px;
}
.tt-ctrl-btn:hover { background: rgba(99,102,241,0.2); color: #818CF8; }
.tt-ctrl-btn--play {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #6366F1, #818CF8);
  color: #fff; box-shadow: 0 0 12px rgba(99,102,241,0.5);
}
.tt-ctrl-btn--play:hover { box-shadow: 0 0 20px rgba(99,102,241,0.7); transform: scale(1.08); }

.tt-timeline__track-wrap { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.tt-track {
  position: relative; height: 4px; border-radius: 99px;
  background: rgba(255,255,255,0.06); cursor: pointer; margin-top: 16px;
}
.tt-track:hover { background: rgba(255,255,255,0.09); }
.tt-track__fill {
  position: absolute; left: 0; top: 0; height: 100%; border-radius: 99px;
  background: linear-gradient(90deg, #6366F1, #818CF8);
  transition: width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); pointer-events: none;
}
.tt-dot {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--sev-color, #818CF8);
  border: 2px solid rgba(9,9,14,0.9);
  cursor: pointer; transition: all 0.15s; z-index: 2;
  box-shadow: 0 0 5px var(--sev-color, #818CF8);
}
.tt-dot:hover { transform: translate(-50%, -50%) scale(1.5); }
.tt-dot--active {
  width: 14px; height: 14px; z-index: 3;
  box-shadow: 0 0 12px var(--sev-color, #818CF8), 0 0 24px rgba(99,102,241,0.35);
}
.tt-playhead {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 3px; height: 22px; border-radius: 2px;
  background: #E2E8F0;
  box-shadow: 0 0 8px rgba(226,232,240,0.8), 0 0 20px rgba(226,232,240,0.35);
  pointer-events: none; z-index: 4;
  transition: left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tt-dates { position: relative; height: 14px; }
.tt-date-label {
  position: absolute; transform: translateX(-50%);
  font-size: 9px; color: #2D3748; transition: color 0.15s; white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
}
.tt-date-label.active { color: #818CF8; }

.tt-timeline__info {
  display: flex; flex-direction: column; gap: 1px;
  min-width: 140px; flex-shrink: 0;
}
.tt-info-sha { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #374151; }
.tt-info-msg { font-size: 11px; color: #64748B; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tt-info-pos { font-size: 10px; color: #2D3748; }

/* Diff stats badge */
.tt-diff-stats {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 8px; border-radius: 20px;
  background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06);
  font-size: 11px; flex-shrink: 0;
}
.tt-diff-stats__fixed { color: #22C55E; font-weight: 600; }
.tt-diff-stats__added { color: #EF4444; font-weight: 600; }
`;
