import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, Button, ProgressBar, Spinner } from 'react-bootstrap';
import {
    FaSync, FaCheck, FaTimes, FaClock, FaSpinner,
    FaServer, FaCodeBranch, FaTerminal, FaCircle,
    FaChevronDown, FaChevronRight, FaExclamationTriangle,
    FaBolt, FaFilter
} from 'react-icons/fa';
import { apiClient } from '../../lib/apiClient';
import { usePolling } from '../../hooks/usePolling';
import { useToast } from '../ToastProvider';
import { SkeletonTable } from '../Skeleton';
import { CopyButton } from '../CopyButton';

/* ── Helpers ─────────────────────────────────────────────────── */
function relativeTime(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(iso).toLocaleDateString();
}

function formatDuration(ms) {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function shortId(id) {
    if (!id) return '—';
    return id.length > 12 ? id.slice(0, 8) + '…' : id;
}

/* ── Status config ───────────────────────────────────────────── */
const STATUS = {
    completed: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   label: 'Completed', Icon: FaCheck    },
    running:   { color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  label: 'Running',   Icon: FaSpinner, spin: true },
    pending:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Pending',   Icon: FaClock    },
    failed:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Failed',    Icon: FaTimes    },
};

function StatusChip({ status }) {
    const s = STATUS[status] || STATUS.pending;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: s.bg, color: s.color,
            border: `1px solid ${s.color}30`,
            borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700,
        }}>
            <s.Icon size={9} className={s.spin ? 'spinning' : ''} />
            {s.label}
        </span>
    );
}

/* ── Summary strip ───────────────────────────────────────────── */
function SummaryStrip({ jobs }) {
    const counts = { running: 0, pending: 0, completed: 0, failed: 0 };
    jobs.forEach(j => { if (j.status in counts) counts[j.status]++; });
    const pills = [
        { key: 'running',   label: 'Running',   color: '#6366f1' },
        { key: 'completed', label: 'Completed', color: '#22c55e' },
        { key: 'failed',    label: 'Failed',    color: '#ef4444' },
        { key: 'pending',   label: 'Pending',   color: '#f59e0b' },
    ];
    return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pills.map(p => (
                <div key={p.key} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--surface-card-elevated, #1C2333)',
                    border: '1px solid var(--border-default, #30363D)',
                    borderRadius: 8, padding: '5px 12px',
                }}>
                    <FaCircle size={7} style={{ color: p.color }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary, #8B949E)' }}>{p.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #E6EDF3)' }}>
                        {counts[p.key]}
                    </span>
                </div>
            ))}
        </div>
    );
}

/* ── Job row ─────────────────────────────────────────────────── */
function JobRow({ job, expanded, onToggle, onSelect }) {
    const s = STATUS[job.status] || STATUS.pending;
    const dur = formatDuration(job.duration_ms);

    return (
        <div style={{
            border: '1px solid var(--border-default, #30363D)',
            borderRadius: 10,
            overflow: 'hidden',
            background: expanded ? 'var(--surface-card, #161B27)' : 'transparent',
            transition: 'all 0.15s ease',
        }}>
            {/* Row header */}
            <div
                onClick={onToggle}
                style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', cursor: 'pointer',
                    background: expanded ? 'rgba(99,102,241,0.04)' : 'transparent',
                }}
            >
                {/* Status stripe */}
                <div style={{
                    width: 3, height: 32, borderRadius: 99,
                    background: s.color, flexShrink: 0,
                }} />

                {/* Icon */}
                <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: s.bg, color: s.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <s.Icon size={12} className={s.spin ? 'spinning' : ''} />
                </div>

                {/* Job ID + repo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: 12, color: '#818cf8', fontFamily: 'var(--font-mono, monospace)' }}>
                            {shortId(job.job_id)}
                        </code>
                        <StatusChip status={job.status} />
                    </div>
                    {job.repo && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <FaCodeBranch size={9} />
                            {job.repo}
                        </div>
                    )}
                </div>

                {/* Duration */}
                {dur && (
                    <div style={{
                        fontSize: 11, color: 'var(--text-muted, #6b7280)',
                        background: 'var(--surface-card-elevated, #1C2333)',
                        border: '1px solid var(--border-default, #30363D)',
                        borderRadius: 6, padding: '2px 8px', flexShrink: 0,
                    }}>
                        {dur}
                    </div>
                )}

                {/* Time */}
                <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', flexShrink: 0, minWidth: 60, textAlign: 'right' }}>
                    {relativeTime(job.started_at)}
                </div>

                {/* Chevron */}
                <div style={{ color: '#6b7280', flexShrink: 0 }}>
                    {expanded ? <FaChevronDown size={11} /> : <FaChevronRight size={11} />}
                </div>
            </div>

            {/* Running progress bar */}
            {job.status === 'running' && !expanded && (
                <ProgressBar
                    animated
                    now={job.progress || 40}
                    style={{ height: 2, borderRadius: 0, marginTop: -1 }}
                    variant="primary"
                />
            )}

            {/* Expanded detail */}
            {expanded && <JobDetail job={job} onDeepDive={onSelect} />}
        </div>
    );
}

/* ── Job detail (expanded inline) ───────────────────────────── */
function JobDetail({ job, onDeepDive }) {
    const dur = formatDuration(job.duration_ms);
    const rows = [
        ['Job ID',     job.job_id,    true],
        ['Status',     <StatusChip status={job.status} />],
        ['Started',    job.started_at   ? new Date(job.started_at).toLocaleString()   : '—'],
        ['Completed',  job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'],
        ['Duration',   dur || '—'],
        ['Repository', job.repo || '—'],
    ];

    return (
        <div style={{ borderTop: '1px solid var(--border-default, #30363D)', padding: '14px 16px' }}>
            {/* Progress for running jobs */}
            {job.status === 'running' && (
                <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>PROGRESS</span>
                        <span style={{ fontSize: 11, color: '#818cf8' }}>{job.progress || 0}%</span>
                    </div>
                    <ProgressBar animated now={job.progress || 40} variant="primary" style={{ height: 6, borderRadius: 4 }} />
                </div>
            )}

            {/* Meta grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', marginBottom: 12 }}>
                {rows.map(([label, value, copy]) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280' }}>
                            {label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-primary, #e6edf3)', wordBreak: 'break-all' }}>
                                {value}
                            </span>
                            {copy && <CopyButton value={String(value || '')} />}
                        </div>
                    </div>
                ))}
            </div>

            {/* Error */}
            {job.error && (
                <div style={{
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                    padding: '10px 14px', marginBottom: 12,
                    background: 'rgba(239,68,68,0.07)',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                    <FaExclamationTriangle size={13} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>ERROR</div>
                        <pre style={{ margin: 0, fontSize: 11, color: '#fca5a5', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono, monospace)' }}>
                            {job.error}
                        </pre>
                    </div>
                </div>
            )}

            {/* Result preview */}
            {job.result && (
                <div style={{ border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{
                        padding: '6px 12px',
                        background: 'rgba(34,197,94,0.06)',
                        borderBottom: '1px solid rgba(34,197,94,0.15)',
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <FaTerminal size={10} style={{ color: '#22c55e' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>RESULT</span>
                    </div>
                    <div style={{
                        background: '#0d1117', padding: '10px 14px',
                        maxHeight: 200, overflowY: 'auto',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: 11, color: '#7ee787', lineHeight: 1.6,
                    }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {typeof job.result === 'string' ? job.result : JSON.stringify(job.result, null, 2)}
                        </pre>
                    </div>
                </div>
            )}

            <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => onDeepDive(job)}
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}
            >
                <FaServer size={10} /> Full session details
            </Button>
        </div>
    );
}

/* ── Session timeline helper ─────────────────────────────────── */
function SessionTimeline({ job }) {
    const events = [
        { label: 'Queued',     time: job.started_at,   status: 'done' },
        { label: 'Processing', time: job.status !== 'pending' ? job.started_at : null,
          status: job.status === 'pending' ? 'pending' : 'done' },
        {
            label: job.status === 'failed' ? 'Failed' : 'Completed',
            time:  job.completed_at,
            status: job.status === 'completed' ? 'done' : job.status === 'failed' ? 'error' : 'pending',
        },
    ];
    const colorMap = { done: '#22c55e', pending: '#374151', error: '#ef4444' };

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {events.map((ev, idx) => (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        {idx > 0 && (
                            <div style={{ flex: 1, height: 2, background: events[idx - 1].status === 'done' ? '#22c55e' : '#374151' }} />
                        )}
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: colorMap[ev.status] + '20',
                            border: `2px solid ${colorMap[ev.status]}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {ev.status === 'done'    && <FaCheck size={10} style={{ color: '#22c55e' }} />}
                            {ev.status === 'error'   && <FaTimes size={10} style={{ color: '#ef4444' }} />}
                            {ev.status === 'pending' && <FaClock size={9}  style={{ color: '#6b7280' }} />}
                        </div>
                        {idx < events.length - 1 && (
                            <div style={{ flex: 1, height: 2, background: ev.status === 'done' ? '#22c55e' : '#374151' }} />
                        )}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 8, padding: '0 4px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary, #e6edf3)' }}>{ev.label}</div>
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                            {ev.time ? relativeTime(ev.time) : '—'}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function MetaTable({ job }) {
    const rows = [
        ['Job ID',      job.job_id,          true],
        ['Repository',  job.repo || '—',     false],
        ['Delivery ID', job.delivery_id || '—', job.delivery_id],
        ['Started',     job.started_at    ? new Date(job.started_at).toLocaleString()    : '—', false],
        ['Completed',   job.completed_at  ? new Date(job.completed_at).toLocaleString()  : '—', false],
        ['Duration',    formatDuration(job.duration_ms) || '—', false],
        ['Progress',    job.progress != null ? `${job.progress}%` : '—', false],
    ];
    return (
        <div style={{ border: '1px solid var(--border-default, #30363D)', borderRadius: 10, overflow: 'hidden' }}>
            {rows.map(([label, value, copy], idx) => (
                <div key={label} style={{
                    display: 'flex', alignItems: 'center', padding: '8px 14px',
                    borderBottom: idx < rows.length - 1 ? '1px solid var(--border-subtle, #21262D)' : 'none',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                }}>
                    <span style={{ width: 120, flexShrink: 0, fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                        {label}
                    </span>
                    <span style={{
                        flex: 1, fontSize: 12, color: 'var(--text-primary, #e6edf3)',
                        fontFamily: (label === 'Job ID' || label === 'Delivery ID') ? 'var(--font-mono, monospace)' : 'inherit',
                        wordBreak: 'break-all',
                    }}>
                        {value}
                    </span>
                    {copy && value !== '—' && <CopyButton value={String(value)} />}
                </div>
            ))}
        </div>
    );
}

/* ── Session detail modal ────────────────────────────────────── */
function SessionModal({ job, onClose, loading }) {
    if (!job) return null;
    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'var(--surface-card, #161B27)',
                    border: '1px solid var(--border-default, #30363D)',
                    borderRadius: 16, width: '100%', maxWidth: 680,
                    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Modal header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-default, #30363D)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--surface-card-elevated, #1C2333)',
                }}>
                    <FaBolt size={14} style={{ color: '#818cf8' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary, #e6edf3)' }}>
                            Worker Session
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)', marginTop: 1 }}>
                            {job.job_id}
                        </div>
                    </div>
                    <StatusChip status={job.status} />
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, lineHeight: 1 }}
                    >
                        <FaTimes size={14} />
                    </button>
                </div>

                {loading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                        <Spinner animation="border" size="sm" style={{ color: '#818cf8' }} />
                    </div>
                ) : (
                    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                        {/* not-found notice */}
                        {job._notFound && (
                            <div style={{
                                border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8,
                                padding: '10px 14px', marginBottom: 16,
                                background: 'rgba(245,158,11,0.07)',
                                fontSize: 12, color: '#d97706',
                            }}>
                                Session not found in cache. Expired or completed inline jobs are not stored in Redis.
                            </div>
                        )}

                        {/* Timeline */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280', marginBottom: 12 }}>
                                Timeline
                            </div>
                            <SessionTimeline job={job} />
                        </div>

                        {/* Metadata */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280', marginBottom: 12 }}>
                                Session metadata
                            </div>
                            <MetaTable job={job} />
                        </div>

                        {/* Error */}
                        {job.error && (
                            <div style={{
                                border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
                                padding: '12px 16px', marginBottom: 20,
                                background: 'rgba(239,68,68,0.06)',
                            }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                    <FaExclamationTriangle size={12} style={{ color: '#ef4444' }} />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>WORKER ERROR</span>
                                </div>
                                <pre style={{ margin: 0, fontSize: 12, color: '#fca5a5', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono, monospace)', lineHeight: 1.6 }}>
                                    {job.error}
                                </pre>
                            </div>
                        )}

                        {/* Full result */}
                        {job.result && (
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280', marginBottom: 12 }}>
                                    Output
                                </div>
                                <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-default, #30363D)' }}>
                                    <div style={{
                                        background: '#0d1117', padding: '14px 16px',
                                        maxHeight: 300, overflowY: 'auto',
                                        fontFamily: 'var(--font-mono, monospace)',
                                        fontSize: 12, color: '#e6edf3', lineHeight: 1.6,
                                    }}>
                                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                            {typeof job.result === 'string' ? job.result : JSON.stringify(job.result, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Main component ──────────────────────────────────────────── */
export default function JobsView({ repoFullName }) {
    const { showToast } = useToast();
    const [jobs, setJobs]               = useState([]);
    const [loading, setLoading]         = useState(true);
    const [expandedId, setExpandedId]   = useState(null);
    const [modalJob, setModalJob]       = useState(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchJobs = useCallback(async () => {
        try {
            const data = await apiClient.get('/api/jobs', { params: { repo: repoFullName, limit: 50 } });
            setJobs(data?.jobs ?? []);
        } catch (err) {
            if (err?.status !== 0 && err?.code !== 'ERR_NETWORK') {
                console.error('Failed to fetch jobs:', err);
            }
        } finally {
            setLoading(false);
        }
    }, [repoFullName]);

    const { lastUpdated, refresh } = usePolling(fetchJobs, { intervalMs: 10000 });
    useEffect(() => { fetchJobs(); }, [fetchJobs]);

    const openModal = async (job) => {
        setModalJob(job);
        setModalLoading(true);
        try {
            const data = await apiClient.get(`/api/jobs/${job.job_id}`);
            setModalJob(data?.data ?? data ?? job);
        } catch (err) {
            if (err?.status === 404) {
                setModalJob({ ...job, _notFound: true });
            } else {
                showToast('Failed to fetch session details', 'danger');
                setModalJob(null);
            }
        } finally {
            setModalLoading(false);
        }
    };

    const filtered = statusFilter === 'all'
        ? jobs
        : jobs.filter(j => j.status === statusFilter);

    const hasRunning = jobs.some(j => j.status === 'running');

    return (
        <div>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <FaServer size={14} style={{ color: '#818cf8' }} />
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary, #e6edf3)' }}>
                            Worker Sessions
                        </span>
                        {hasRunning && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                                border: '1px solid rgba(99,102,241,0.25)',
                                borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                            }}>
                                <FaCircle size={6} style={{ animationDuration: '2s' }} />
                                LIVE
                            </span>
                        )}
                    </div>
                    {lastUpdated && (
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                            Updated {relativeTime(lastUpdated.toISOString())}
                        </div>
                    )}
                </div>
                <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => refresh()}
                    disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                >
                    <FaSync size={10} className={loading ? 'spinning' : ''} />
                    Refresh
                </Button>
            </div>

            {/* ── Summary strip ── */}
            {jobs.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <SummaryStrip jobs={jobs} />
                </div>
            )}

            {/* ── Status filter ── */}
            {jobs.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <FaFilter size={10} style={{ color: '#6b7280' }} />
                    {['all', 'running', 'completed', 'failed', 'pending'].map(f => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            style={{
                                background: statusFilter === f ? 'rgba(99,102,241,0.15)' : 'transparent',
                                color: statusFilter === f ? '#818cf8' : '#6b7280',
                                border: `1px solid ${statusFilter === f ? 'rgba(99,102,241,0.4)' : 'var(--border-default, #30363D)'}`,
                                borderRadius: 6, padding: '3px 10px',
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                textTransform: 'capitalize',
                            }}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Content ── */}
            {loading && jobs.length === 0 ? (
                <SkeletonTable columns={4} rows={4} />
            ) : filtered.length === 0 ? (
                <div style={{
                    border: '1px dashed var(--border-default, #30363D)',
                    borderRadius: 12, padding: '40px 20px',
                    textAlign: 'center', color: '#6b7280',
                }}>
                    <FaServer size={28} style={{ opacity: 0.3, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {statusFilter === 'all' ? 'No worker sessions yet' : `No ${statusFilter} sessions`}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                        Sessions appear here when a scan is queued.
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filtered.map(job => (
                        <JobRow
                            key={job.job_id}
                            job={job}
                            expanded={expandedId === job.job_id}
                            onToggle={() => setExpandedId(prev => prev === job.job_id ? null : job.job_id)}
                            onSelect={openModal}
                        />
                    ))}
                </div>
            )}

            {/* ── Session detail modal ── */}
            {modalJob && (
                <SessionModal
                    job={modalJob}
                    loading={modalLoading}
                    onClose={() => setModalJob(null)}
                />
            )}
        </div>
    );
}
