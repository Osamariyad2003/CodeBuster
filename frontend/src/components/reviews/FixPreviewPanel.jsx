import React, { useState } from 'react';
import { Badge, Button } from 'react-bootstrap';
import { FaCopy, FaCheck, FaCodeBranch, FaExclamationTriangle, FaShieldAlt } from 'react-icons/fa';

/* ── Diff line renderer with line-number gutter ─────────────────────────── */
function DiffLine({ line, oldNum, newNum }) {
    const isAdd    = line.startsWith('+') && !line.startsWith('+++');
    const isDel    = line.startsWith('-') && !line.startsWith('---');
    const isHunk   = line.startsWith('@@');
    const isMeta   = line.startsWith('+++') || line.startsWith('---');

    let bg        = 'transparent';
    let color     = 'var(--diff-text, #e6edf3)';
    let gutterBg  = 'transparent';

    if (isAdd)  { bg = 'rgba(46,160,67,0.14)';  color = '#7ee787'; gutterBg = 'rgba(46,160,67,0.22)'; }
    if (isDel)  { bg = 'rgba(248,81,73,0.14)';   color = '#ffa198'; gutterBg = 'rgba(248,81,73,0.22)'; }
    if (isHunk) { bg = 'rgba(56,139,253,0.10)';  color = '#79c0ff'; }
    if (isMeta) { color = '#8b949e'; }

    const content = (isAdd || isDel) ? line.slice(1) : line;
    const sign    = isAdd ? '+' : isDel ? '−' : ' ';

    return (
        <div style={{ display: 'flex', background: bg, fontSize: 12, lineHeight: '20px', fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
            {/* Old line number */}
            <span style={{
                width: 38, textAlign: 'right', paddingRight: 8,
                color: '#6b7280', userSelect: 'none', flexShrink: 0,
                background: gutterBg, borderRight: '1px solid rgba(255,255,255,0.06)',
            }}>
                {isHunk || isMeta || isAdd ? '' : oldNum}
            </span>
            {/* New line number */}
            <span style={{
                width: 38, textAlign: 'right', paddingRight: 8,
                color: '#6b7280', userSelect: 'none', flexShrink: 0,
                background: gutterBg, borderRight: '1px solid rgba(255,255,255,0.06)',
            }}>
                {isHunk || isMeta || isDel ? '' : newNum}
            </span>
            {/* Sign */}
            <span style={{ width: 18, textAlign: 'center', color, flexShrink: 0, opacity: 0.9 }}>
                {isHunk || isMeta ? '' : sign}
            </span>
            {/* Code */}
            <span style={{ flex: 1, color, whiteSpace: 'pre', paddingRight: 12, overflow: 'hidden' }}>
                {content}
            </span>
        </div>
    );
}

/* ── Copy button ─────────────────────────────────────────────────────────── */
function CopyButton({ text, label = 'Copy' }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };
    return (
        <Button variant="link" size="sm" onClick={copy}
            style={{ color: copied ? '#22c55e' : '#9ca3af', padding: '2px 6px', fontSize: 11 }}>
            {copied ? <FaCheck size={10} className="me-1" /> : <FaCopy size={10} className="me-1" />}
            {copied ? 'Copied' : label}
        </Button>
    );
}

/* ── Stat pill ───────────────────────────────────────────────────────────── */
function StatPill({ value, color, sign }) {
    if (!value) return null;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: color + '20', color, border: `1px solid ${color}40`,
            borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700,
        }}>
            {sign}{value}
        </span>
    );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function FixPreviewPanel({ preview }) {
    const [diffExpanded, setDiffExpanded] = useState(true);

    if (!preview) return null;

    const stats     = preview.stats || { added: 0, removed: 0 };
    const isSecret  = preview.category === 'secret_leak' || preview.category === 'high_entropy_secret';

    /* Parse unified diff and track line numbers */
    const parsedLines = [];
    let oldLine = 0;
    let newLine = 0;
    for (const raw of (preview.diff || '').split('\n')) {
        if (raw.startsWith('@@')) {
            const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            if (m) { oldLine = parseInt(m[1], 10); newLine = parseInt(m[2], 10); }
            parsedLines.push({ line: raw, oldNum: null, newNum: null });
        } else if (raw.startsWith('---') || raw.startsWith('+++')) {
            parsedLines.push({ line: raw, oldNum: null, newNum: null });
        } else if (raw.startsWith('-')) {
            parsedLines.push({ line: raw, oldNum: oldLine++, newNum: null });
        } else if (raw.startsWith('+')) {
            parsedLines.push({ line: raw, oldNum: null, newNum: newLine++ });
        } else {
            parsedLines.push({ line: raw, oldNum: oldLine++, newNum: newLine++ });
        }
    }

    return (
        <div style={{
            background: 'var(--surface-card, #161B27)',
            border: '1px solid var(--border-default, #30363D)',
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 16,
        }}>
            {/* ── Header ── */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-default, #30363D)',
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                background: 'rgba(99,102,241,0.04)',
            }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary, #E6EDF3)', flex: 1 }}>
                    Fix Preview
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {preview.language && (
                        <Badge bg="secondary" style={{ textTransform: 'uppercase', fontSize: 10 }}>{preview.language}</Badge>
                    )}
                    {preview.strategy && (
                        <Badge bg="light" text="dark" style={{ fontSize: 10 }}>{preview.strategy}</Badge>
                    )}
                    <StatPill value={stats.added}   color="#22c55e" sign="+" />
                    <StatPill value={stats.removed} color="#ef4444" sign="−" />
                </div>
            </div>

            {/* ── The problem (why this exists) ── */}
            {(preview.problem_title || preview.problem_description) && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default, #30363D)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <FaExclamationTriangle size={11} style={{ color: '#f59e0b' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280' }}>
                            The problem
                        </span>
                        {preview.problem_severity && (
                            <Badge bg="light" text="dark" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                                {preview.problem_severity}
                            </Badge>
                        )}
                    </div>
                    {preview.problem_title && (
                        <p style={{ margin: 0, marginBottom: preview.problem_description ? 4 : 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #E6EDF3)' }}>
                            {preview.problem_title}
                        </p>
                    )}
                    {preview.problem_description && (
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary, #8B949E)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                            {preview.problem_description}
                        </p>
                    )}
                    {Array.isArray(preview.problem_evidence) && preview.problem_evidence.length > 0 && (
                        <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: '#8b949e' }}>
                            {preview.problem_evidence.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    )}
                </div>
            )}

            {/* ── What this fix does ── */}
            {preview.description && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default, #30363D)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280', marginBottom: 6 }}>
                        What this fix does
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #8B949E)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {preview.description}
                    </p>
                </div>
            )}

            {/* ── Secret redaction warning ── */}
            {isSecret && preview.commit_summary && (
                <div style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid rgba(245,158,11,0.25)',
                    background: 'rgba(245,158,11,0.07)',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                    <FaShieldAlt size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                    <p style={{ margin: 0, fontSize: 12, color: '#d97706', lineHeight: 1.6 }}>
                        {preview.commit_summary}
                    </p>
                </div>
            )}

            {/* ── Before / After single-line comparison ── */}
            {(preview.before || preview.after) && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default, #30363D)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280', marginBottom: 8 }}>
                        Change at line {preview.line_number}
                    </div>
                    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-default, #30363D)', fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 12 }}>
                        {preview.before && (
                            <div style={{ background: 'rgba(248,81,73,0.12)', padding: '8px 12px', color: '#ffa198', display: 'flex', gap: 8 }}>
                                <span style={{ opacity: 0.6, userSelect: 'none', flexShrink: 0 }}>−</span>
                                <span style={{ whiteSpace: 'pre-wrap', flex: 1 }}>{preview.before.trim()}</span>
                            </div>
                        )}
                        {preview.after && (
                            <div style={{ background: 'rgba(46,160,67,0.12)', padding: '8px 12px', color: '#7ee787', display: 'flex', gap: 8 }}>
                                <span style={{ opacity: 0.6, userSelect: 'none', flexShrink: 0 }}>+</span>
                                <span style={{ whiteSpace: 'pre-wrap', flex: 1 }}>{preview.after.trim()}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Unified diff ── */}
            {preview.diff && (
                <div>
                    <div
                        style={{
                            padding: '8px 16px', display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', cursor: 'pointer',
                            borderBottom: diffExpanded ? '1px solid var(--border-default, #30363D)' : 'none',
                        }}
                        onClick={() => setDiffExpanded(v => !v)}
                    >
                        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                            {diffExpanded ? '▾' : '▸'} Unified diff · {parsedLines.length} lines
                        </span>
                        <CopyButton text={preview.diff} label="Copy diff" />
                    </div>

                    {diffExpanded && (
                        <div style={{ overflowX: 'auto', background: '#0d1117', maxHeight: 420, overflowY: 'auto' }}>
                            {parsedLines.map((p, i) => (
                                <DiffLine key={i} line={p.line} oldNum={p.oldNum} newNum={p.newNum} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Footer: branch + commit message ── */}
            <div style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--border-default, #30363D)',
                background: 'rgba(0,0,0,0.15)',
                display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7280', flex: 1, minWidth: 0 }}>
                    <FaCodeBranch size={10} style={{ flexShrink: 0 }} />
                    <code style={{ color: '#818cf8', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preview.branch_preview}
                    </code>
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                    {preview.commit_message}
                </div>
            </div>
        </div>
    );
}
