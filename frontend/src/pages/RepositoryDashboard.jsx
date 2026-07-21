import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Nav, Button, Badge, Spinner } from 'react-bootstrap';
import {
    FaStream, FaGithub, FaCheck, FaClock,
    FaTimes, FaChartBar,
    FaShieldAlt, FaExclamationTriangle, FaInfoCircle, FaBolt,
    FaPlay, FaArrowRight, FaChartLine, FaListUl, FaRobot,
    FaCheckCircle, FaTimesCircle, FaTachometerAlt, FaBug,
    FaCalendarAlt, FaLayerGroup, FaFire,
} from 'react-icons/fa';
import { apiClient } from '../lib/apiClient';
import { triggerScan } from '../lib/apiClient';
import { useToast } from '../components/ToastProvider';
import ScanProgressBanner from '../components/ScanProgressBanner';

import EventsView from '../components/monitoring/EventsView';
import JobsView from '../components/monitoring/JobsView';
import ReviewsView from '../components/monitoring/ReviewsView';
import AnalyticsView from '../components/monitoring/AnalyticsView';
import HealthTrendChart from '../components/HealthTrendChart';
import CategoryRadarChart from '../components/reviews/CategoryRadarChart';
import IssueTable from '../components/reviews/IssueTable';
import FixFirstChecklist from '../components/reviews/FixFirstChecklist';
import IssueDetailDrawer from '../components/reviews/IssueDetailDrawer';
import RadialScoreRing from '../components/RadialScoreRing';
import { getLatestReview, getScoreTrend } from '../lib/apiClient';

import './RepositoryDashboard.css';

/* ── helpers ─────────────────────────────────────────────────── */
const gradeColor = (g) => ({ A: '#10B981', B: '#3B82F6', C: '#F59E0B', D: '#EF4444', F: '#EF4444' }[g] || '#6B7280');
const scoreColor = (s) => s >= 80 ? '#10B981' : s >= 60 ? '#F59E0B' : '#EF4444';

/* Severity pill for hero */
function SeverityPill({ count, severity, icon: Icon, color }) {
    if (!count) return null;
    return (
        <div className="dash-severity-pill" style={{ color }}>
            <Icon size={11} />
            <span>{count}</span>
            <span style={{ opacity: 0.7, fontWeight: 500, textTransform: 'capitalize', fontSize: '0.72rem' }}>{severity}</span>
        </div>
    );
}

/* Section header */
function SectionLabel({ icon: Icon, children, action }) {
    return (
        <div className="dash-section-label">
            <div className="dash-section-label-inner">
                {Icon && <Icon size={13} className="dash-section-icon" />}
                <span className="dash-section-label-text">{children}</span>
            </div>
            {action}
        </div>
    );
}

/* Insight banner */
function InsightBanner({ score, grade, findingsCounts }) {
    if (score == null) return null;
    const critical = findingsCounts?.critical ?? 0;
    const major    = findingsCounts?.major    ?? 0;

    let cls, Icon, message;
    if (critical > 0) {
        cls = 'dash-insight dash-insight-critical'; Icon = FaTimesCircle;
        message = `${critical} critical issue${critical > 1 ? 's' : ''} detected — fix ${critical > 1 ? 'these' : 'this'} before shipping.`;
    } else if (major > 0) {
        cls = 'dash-insight dash-insight-major'; Icon = FaExclamationTriangle;
        message = `${major} major issue${major > 1 ? 's' : ''} found — review and address them soon.`;
    } else if (score >= 80) {
        cls = 'dash-insight dash-insight-good'; Icon = FaCheckCircle;
        message = `Excellent health score of ${score}. Keep up the great work!`;
    } else {
        cls = 'dash-insight dash-insight-neutral'; Icon = FaTachometerAlt;
        message = `Health score is ${score}/100 (Grade ${grade || '?'}). Focus on the fix-first list below to improve it.`;
    }

    return (
        <div className={cls}>
            <Icon size={16} style={{ flexShrink: 0 }} />
            <span>{message}</span>
        </div>
    );
}

/* Divider */
function Divider({ label }) {
    return (
        <div className="dash-divider">
            <div className="dash-divider-line" />
            {label && <span className="dash-divider-label">{label}</span>}
            <div className="dash-divider-line" />
        </div>
    );
}

/* Stat card */
function StatCard({ icon, iconBg, iconColor, value, label, sub }) {
    return (
        <div className="dash-stat-card">
            <div className="d-flex align-items-center gap-3 mb-3">
                <div className="dash-stat-icon" style={{ background: iconBg, color: iconColor }}>
                    {icon}
                </div>
            </div>
            <div className="dash-stat-value">{value ?? '—'}</div>
            <div className="dash-stat-label">{label}</div>
            {sub && <div style={{ fontSize: '0.7rem', color: '#6E7681', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

/* ── main component ───────────────────────────────────────────── */
export default function RepositoryDashboard() {
    const { repoId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();

    const [repo, setRepo] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [activeTab, setActiveTab] = useState(
        () => new URLSearchParams(location.search).get('tab') || 'reviews'
    );
    const [justConnected, setJustConnected] = useState(!!location.state?.justConnected);
    const [latestReview, setLatestReview] = useState(null);
    const [scoreTrend, setScoreTrend] = useState([]);
    const [selectedIssue, setSelectedIssue] = useState(null);
    const [showIssueDrawer, setShowIssueDrawer] = useState(false);
    const pollAfterScanRef = useRef(null);
    const [scanJobId, setScanJobId] = useState(null);
    const [inlineScanning, setInlineScanning] = useState(false);
    const inlineScanStartRef = useRef(null);

    const fetchRepoData = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/api/repos/${repoId}`);
            if (response.success) setRepo(response.repo);
            else showToast(response.error || 'Failed to fetch repository details', 'danger');
        } catch (_) {
            showToast('Failed to fetch repository details', 'danger');
        } finally {
            setLoading(false);
        }
    }, [repoId, showToast]);

    const fetchRepoStats = useCallback(async () => {
        try {
            setStatsLoading(true);
            const response = await apiClient.get(`/api/repos/${repoId}/stats`);
            if (response.success) setStats(response.stats);
        } catch (_) {}
        finally { setStatsLoading(false); }
    }, [repoId]);

    const fetchLatestReview = useCallback(async () => {
        if (!repoId) return;
        try {
            const res = await getLatestReview(repoId);
            if (res.review) setLatestReview(res);
        } catch (_) { setLatestReview(null); }
    }, [repoId]);

    const fetchScoreTrend = useCallback(async () => {
        if (!repoId) return;
        try {
            const data = await getScoreTrend(repoId, 30);
            setScoreTrend(Array.isArray(data) ? data : []);
        } catch (_) { setScoreTrend([]); }
    }, [repoId]);

    useEffect(() => { fetchRepoData(); fetchRepoStats(); }, [fetchRepoData, fetchRepoStats]);
    useEffect(() => { fetchLatestReview(); fetchScoreTrend(); }, [fetchLatestReview, fetchScoreTrend]);
    useEffect(() => () => { if (pollAfterScanRef.current) clearInterval(pollAfterScanRef.current); }, []);

    const handleManualScan = async (commitSha) => {
        try {
            setScanning(true);
            setScanJobId(null);
            const body = commitSha ? { commit_sha: commitSha } : {};
            const response = await triggerScan(repoId, body);
            if (!response.success) { showToast(response.error || 'Failed to trigger scan', 'danger'); return; }
            setActiveTab('reviews');
            if (response.idempotent && response.review_id) {
                showToast('A review already exists for this commit.', 'info');
                fetchLatestReview(); fetchScoreTrend();
                navigate(`/reviews/${response.review_id}`);
                return;
            }
            if (response.job_id) {
                setScanJobId(response.job_id);
                showToast('Scan started. Track progress below.', 'success');
            } else if (response.inline) {
                showToast('Scan started. Track progress below.', 'success');
                inlineScanStartRef.current = Date.now();
                setInlineScanning(true);
                const pollMs = 8000, maxAttempts = 24;
                let attempts = 0;
                if (pollAfterScanRef.current) clearInterval(pollAfterScanRef.current);
                pollAfterScanRef.current = setInterval(() => {
                    attempts++;
                    if (attempts > maxAttempts) {
                        clearInterval(pollAfterScanRef.current); pollAfterScanRef.current = null;
                        setInlineScanning(false);
                        showToast('Scan is taking longer than expected. Check back later.', 'info');
                        return;
                    }
                    getLatestReview(repoId).then((res) => {
                        if (res?.review?.id) {
                            setLatestReview(res);
                            setScoreTrend((prev) => {
                                const next = Array.isArray(prev) ? [...prev] : [];
                                const d = res.review?.completed_at?.slice(0, 10);
                                const s = res.review?.overall_health_score ?? 0;
                                if (d && (next.length === 0 || next[next.length - 1]?.date !== d)) next.push({ date: d, overall_score: s });
                                return next;
                            });
                            clearInterval(pollAfterScanRef.current); pollAfterScanRef.current = null;
                            setInlineScanning(false);
                            showToast('Review ready.', 'success');
                        }
                    }).catch(() => {});
                }, pollMs);
            } else {
                showToast(response.message || 'Scan started.', 'success');
                fetchLatestReview();
            }
        } catch (err) {
            showToast(err?.message || 'Failed to trigger scan', 'danger');
        } finally {
            setScanning(false);
        }
    };

    const handleScanComplete = (reviewId) => {
        setScanJobId(null);
        if (reviewId) navigate(`/reviews/${reviewId}`);
        else { fetchLatestReview(); fetchScoreTrend(); }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
            <Spinner animation="border" style={{ color: '#6366F1' }} />
        </div>
    );

    if (!repo) return (
        <div className="text-center py-5" style={{ color: 'var(--text-primary)' }}>
            <h3 style={{ fontWeight: 700 }}>Repository not found</h3>
            <button className="btn btn-primary mt-3" onClick={() => navigate('/repos')}>Back to Repositories</button>
        </div>
    );

    const review         = latestReview?.review;
    const score          = review?.overall_health_score ?? null;
    const grade          = review?.grade;
    const findingsCounts = latestReview?.findings_count || review?.findings_count || {};
    const hasTrend       = scoreTrend.length > 0 || (stats?.trend?.length ?? 0) > 0;
    const trendData      = scoreTrend.length
        ? scoreTrend.map(d => ({ date: d.date?.slice(0, 10) ?? 'N/A', score: d.overall_score }))
        : (stats?.trend || []);

    const totalIssues   = (findingsCounts.critical ?? 0) + (findingsCounts.major ?? 0) + (findingsCounts.minor ?? 0) + (findingsCounts.info ?? 0);

    return (
        <div className="repository-dashboard">
            <main className="container-fluid px-3 px-md-4 py-3 py-md-4">

                {/* Just-connected banner */}
                {justConnected && (
                    <div className="dash-connected-alert d-flex align-items-center justify-content-between gap-3 flex-wrap mb-4">
                        <div className="d-flex align-items-center gap-3">
                            <FaCheck style={{ color: '#10B981', flexShrink: 0 }} size={16} />
                            <div>
                                <strong>Repository connected!</strong> Initial scan of <strong>{repo.full_name}</strong> is queued.
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>Track progress in Analysis Jobs tab.</div>
                            </div>
                        </div>
                        <div className="d-flex gap-2">
                            <button className="btn btn-sm" style={{ background: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.25)', fontWeight: 600, borderRadius: 8 }}
                                onClick={() => { setActiveTab('jobs'); setJustConnected(false); }}>View Jobs</button>
                            <button className="btn btn-sm btn-link p-0" style={{ color: 'var(--text-muted)' }} onClick={() => setJustConnected(false)}><FaTimes /></button>
                        </div>
                    </div>
                )}

                {/* Disconnected warning */}
                {repo.status && String(repo.status).toLowerCase() !== 'active' && (
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4 px-4 py-3 rounded-3"
                        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#FCD34D' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>This repository is disconnected. Reconnect to run scans.</span>
                        <button className="btn btn-sm" style={{ background: 'rgba(245,158,11,0.15)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)', fontWeight: 600, borderRadius: 8 }}
                            onClick={() => navigate('/repos')}>Reconnect</button>
                    </div>
                )}

                {/* ── HERO ─────────────────────────────────────────────── */}
                <div className="dash-hero mb-4">
                    <div className="dash-hero-card rounded-4 p-3 p-md-4">
                        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">

                            {/* Left */}
                            <div className="flex-grow-1 min-w-0">
                                {/* Breadcrumb */}
                                <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                    <FaGithub size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem' }}>{repo.full_name}</span>
                                    {repo.is_private && (
                                        <span style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', fontSize: '0.6rem', fontWeight: 700, borderRadius: 5, padding: '2px 7px', border: '1px solid rgba(255,255,255,0.1)' }}>Private</span>
                                    )}
                                    {repo.language && (
                                        <span style={{ background: 'rgba(99,102,241,0.2)', color: '#A5B4FC', fontSize: '0.6rem', fontWeight: 700, borderRadius: 5, padding: '2px 7px', border: '1px solid rgba(99,102,241,0.25)' }}>{repo.language}</span>
                                    )}
                                </div>

                                {/* Repo name */}
                                <h1 style={{
                                    color: '#F8FAFC', fontWeight: 800,
                                    fontSize: 'clamp(1.35rem,4vw,2rem)',
                                    margin: 0, letterSpacing: '-0.03em',
                                    textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                }}>
                                    {repo.name}
                                </h1>

                                {/* Scan meta */}
                                {review && (
                                    <div className="d-flex align-items-center gap-3 mt-2 flex-wrap">
                                        <div className="d-flex align-items-center gap-1" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.74rem' }}>
                                            <FaCalendarAlt size={10} />
                                            Last scanned {new Date(review.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                        <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.1)' }} />
                                        <div className="d-flex align-items-center gap-3 flex-wrap">
                                            <SeverityPill count={findingsCounts.critical} severity="Critical" icon={FaShieldAlt}           color="#F87171" />
                                            <SeverityPill count={findingsCounts.major}    severity="Major"    icon={FaExclamationTriangle} color="#FBBF24" />
                                            <SeverityPill count={findingsCounts.minor}    severity="Minor"    icon={FaInfoCircle}          color="#60A5FA" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: score + actions */}
                            <div className="d-flex align-items-center gap-4 flex-shrink-0">
                                {score !== null && (
                                    <div className="dash-score-badge">
                                        <RadialScoreRing score={score} size={90} strokeWidth={7} />
                                        {grade && (
                                            <div style={{
                                                color: gradeColor(grade), fontWeight: 800,
                                                fontSize: '0.95rem', letterSpacing: '-0.01em',
                                                marginTop: 2,
                                            }}>
                                                Grade {grade}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="d-flex flex-column gap-2">
                                    <button
                                        disabled={scanning || inlineScanning}
                                        onClick={() => handleManualScan()}
                                        className="btn d-flex align-items-center gap-2"
                                        style={{
                                            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                                            color: '#fff', border: 'none', borderRadius: 9,
                                            fontWeight: 700, fontSize: '0.86rem',
                                            padding: '9px 20px', whiteSpace: 'nowrap',
                                            boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                                            opacity: (scanning || inlineScanning) ? 0.7 : 1,
                                        }}
                                    >
                                        {(scanning || inlineScanning) ? <Spinner animation="border" size="sm" /> : <FaPlay size={11} />}
                                        {(scanning || inlineScanning) ? 'Scanning…' : 'Run Scan'}
                                    </button>
                                    {review && (
                                        <button
                                            onClick={() => navigate(`/reviews/${review.id}`)}
                                            className="btn d-flex align-items-center gap-2"
                                            style={{
                                                background: 'rgba(255,255,255,0.07)',
                                                color: 'rgba(255,255,255,0.75)',
                                                border: '1px solid rgba(255,255,255,0.15)',
                                                borderRadius: 9, fontWeight: 600,
                                                fontSize: '0.86rem', padding: '8px 20px',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            Full Report <FaArrowRight size={11} />
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-link p-0 d-flex align-items-center gap-2"
                                        style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.72rem', textDecoration: 'none' }}
                                        onClick={() => window.open(`https://github.com/${repo.full_name}`, '_blank')}
                                    >
                                        <FaGithub size={12} /> View on GitHub
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scan progress */}
                {scanJobId && (
                    <ScanProgressBanner jobId={scanJobId} repoId={repoId} onComplete={handleScanComplete} onDismiss={() => setScanJobId(null)} />
                )}
                {inlineScanning && !scanJobId && (
                    <ScanProgressBanner
                        mode="inline"
                        repoId={repoId}
                        startedAt={inlineScanStartRef.current}
                        onDismiss={() => {
                            setInlineScanning(false);
                            if (pollAfterScanRef.current) { clearInterval(pollAfterScanRef.current); pollAfterScanRef.current = null; }
                        }}
                    />
                )}

                {/* ── EMPTY STATES ───────────────────────────────────────── */}
                {!review && !scanJobId && !scanning && !inlineScanning && (
                    <div className="dash-empty">
                        <div style={{
                            width: 64, height: 64, borderRadius: 16,
                            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}>
                            <FaBolt size={26} style={{ color: '#6366F1' }} />
                        </div>
                        <h5 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>No scan results yet</h5>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: 360, margin: '0 auto 24px', fontSize: '0.88rem' }}>
                            Run a scan to get your health score, find issues, and see AI-powered fix suggestions.
                        </p>
                        <button className="btn d-inline-flex align-items-center gap-2"
                            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, padding: '10px 24px', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
                            onClick={() => handleManualScan()}>
                            <FaPlay size={12} /> Run First Scan
                        </button>
                    </div>
                )}

                {!review && (scanJobId || scanning || inlineScanning) && (
                    <div className="dash-scan-pending">
                        <Spinner animation="border" style={{ color: '#6366F1', marginBottom: 12 }} />
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 0, fontSize: '0.88rem' }}>
                            Scan in progress — results will appear here automatically.
                        </p>
                    </div>
                )}

                {/* ── OVERVIEW ───────────────────────────────────────────── */}
                {review && (
                    <>
                        {/* Insight banner */}
                        <InsightBanner score={score} grade={grade} findingsCounts={findingsCounts} />

                        {/* Stats at a glance */}
                        <SectionLabel icon={FaTachometerAlt}>At a Glance</SectionLabel>
                        <div className="row g-3 mb-4">
                            <div className="col-6 col-md-4 col-lg">
                                <StatCard
                                    icon={<FaShieldAlt size={16} />}
                                    iconBg="rgba(16,185,129,0.12)" iconColor="#10B981"
                                    value={score !== null ? `${score}%` : '—'}
                                    label="Health Score"
                                    sub={grade ? `Grade ${grade}` : undefined}
                                />
                            </div>
                            <div className="col-6 col-md-4 col-lg">
                                <StatCard
                                    icon={<FaBug size={16} />}
                                    iconBg="rgba(99,102,241,0.12)" iconColor="#818CF8"
                                    value={totalIssues || stats?.total_issues}
                                    label="Total Issues"
                                />
                            </div>
                            <div className="col-6 col-md-4 col-lg">
                                <StatCard
                                    icon={<FaFire size={16} />}
                                    iconBg="rgba(239,68,68,0.12)" iconColor="#F87171"
                                    value={findingsCounts.critical ?? 0}
                                    label="Critical"
                                />
                            </div>
                            <div className="col-6 col-md-4 col-lg">
                                <StatCard
                                    icon={<FaStream size={16} />}
                                    iconBg="rgba(59,130,246,0.12)" iconColor="#60A5FA"
                                    value={stats?.recent_events ?? 0}
                                    label="Recent Events"
                                />
                            </div>
                            <div className="col-6 col-md-4 col-lg">
                                <StatCard
                                    icon={<FaClock size={16} />}
                                    iconBg="rgba(245,158,11,0.12)" iconColor="#FBBF24"
                                    value={stats?.active_jobs ?? 0}
                                    label="Active Jobs"
                                />
                            </div>
                        </div>

                        {/* AI Analysis: Radar + Fix-first */}
                        <SectionLabel
                            icon={FaRobot}
                            action={
                                <button className="btn btn-link p-0 d-flex align-items-center gap-1"
                                    style={{ color: '#818CF8', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}
                                    onClick={() => navigate(`/reviews/${review.id}`)}>
                                    Full report <FaArrowRight size={9} />
                                </button>
                            }
                        >
                            AI Analysis
                        </SectionLabel>
                        <div className="row mb-4 g-3">
                            <div className="col-md-6">
                                <div className="dash-card h-100">
                                    <div className="dash-card-header">
                                        <FaChartBar size={12} style={{ color: '#6366F1' }} />
                                        Category Scores
                                    </div>
                                    <div className="p-3 pt-2">
                                        <CategoryRadarChart
                                            categories={latestReview?.categories || []}
                                            height={250}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="dash-card h-100">
                                    <div className="dash-card-header">
                                        <FaListUl size={12} style={{ color: '#6366F1' }} />
                                        Fix First
                                    </div>
                                    <div className="p-3 pt-2" style={{ maxHeight: 340, overflowY: 'auto' }}>
                                        <FixFirstChecklist items={latestReview?.fix_first || []} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Health trend */}
                        {hasTrend && (
                            <>
                                <SectionLabel icon={FaChartLine}>Health Trend — 30 days</SectionLabel>
                                <div className="dash-card mb-4">
                                    <div className="p-3 p-md-4">
                                        <HealthTrendChart data={trendData} />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Issues */}
                        <SectionLabel
                            icon={FaShieldAlt}
                            action={
                                <button className="btn btn-link p-0 d-flex align-items-center gap-1"
                                    style={{ color: '#818CF8', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}
                                    onClick={() => navigate(`/reviews/${review.id}`)}>
                                    View all <FaArrowRight size={9} />
                                </button>
                            }
                        >
                            Issues — Latest Review
                        </SectionLabel>
                        <div className="dash-card mb-4">
                            <div className="p-0">
                                <IssueTable
                                    reviewId={review.id}
                                    onSelectIssue={(issue) => { setSelectedIssue(issue); setShowIssueDrawer(true); }}
                                />
                            </div>
                        </div>
                    </>
                )}

                <IssueDetailDrawer show={showIssueDrawer} onHide={() => setShowIssueDrawer(false)} issue={selectedIssue} />

                {/* ── TABS ──────────────────────────────────────────────── */}
                <Divider label="Activity" />

                <Nav variant="tabs" className="repo-dashboard-tabs flex-nowrap mb-0">
                    {[
                        { key: 'reviews',   icon: <FaCheck size={12} />,       label: 'AI Reviews'      },
                        { key: 'events',    icon: <FaStream size={12} />,      label: 'Webhook Events'  },
                        { key: 'jobs',      icon: <FaClock size={12} />,       label: 'Analysis Jobs'   },
                        { key: 'analytics', icon: <FaChartBar size={12} />,    label: 'Analytics'       },
                    ].map(({ key, icon, label }) => (
                        <Nav.Item key={key} className="flex-shrink-0">
                            <Nav.Link active={activeTab === key} onClick={() => setActiveTab(key)}
                                className="d-flex align-items-center gap-2">
                                {icon} {label}
                            </Nav.Link>
                        </Nav.Item>
                    ))}
                </Nav>

                <div className="tab-content pt-3">
                    {activeTab === 'reviews'   && <ReviewsView key={review?.id ?? 'no-review'} repoId={repoId} repoFullName={repo?.full_name} onRunScan={handleManualScan} />}
                    {activeTab === 'events'    && <EventsView repoFullName={repo.full_name} />}
                    {activeTab === 'jobs'      && <JobsView   repoFullName={repo.full_name} />}
                    {activeTab === 'analytics' && <AnalyticsView repoId={repoId} />}
                </div>
            </main>
        </div>
    );
}
