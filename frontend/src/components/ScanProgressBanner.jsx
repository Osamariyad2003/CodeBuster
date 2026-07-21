import React, { useState, useEffect, useRef } from 'react';
import { Alert, Button, Spinner, ProgressBar } from 'react-bootstrap';
import { getJob } from '../lib/apiClient';

const POLL_INTERVAL_MS = 5000;
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

// Mirrors the real analyzer order in review_orchestrator.py — this is a
// no-backend-telemetry approximation (we don't stream true per-analyzer
// progress), so it's presented as descriptive stage text, not a percentage.
const INLINE_STAGES = [
    { afterMs: 0, label: 'Fetching repository files…' },
    { afterMs: 8000, label: 'Running security & secrets scan…' },
    { afterMs: 20000, label: 'Checking dependencies for known vulnerabilities…' },
    { afterMs: 35000, label: 'Analyzing code quality & duplicate code…' },
    { afterMs: 55000, label: 'Running performance analysis…' },
    { afterMs: 80000, label: 'Running AI reasoning over findings…' },
    { afterMs: 130000, label: 'Finalizing report…' },
];

function elapsedLabel(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function currentInlineStage(elapsedMs) {
    let stage = INLINE_STAGES[0];
    for (const s of INLINE_STAGES) {
        if (elapsedMs >= s.afterMs) stage = s;
    }
    return stage.label;
}

/**
 * Scan progress banner. Two modes:
 *  - mode="job" (default): polls GET /api/jobs/{jobId} for real status
 *    (Queued / Running / Completed / Failed).
 *  - mode="inline": no backend job exists to poll (Celery/Redis unavailable,
 *    scan ran in a background thread instead). Shows a persistent running
 *    indicator with elapsed time and rotating stage labels so the user gets
 *    visible feedback instead of silence. The parent is responsible for
 *    detecting completion (polling latest-review) and unmounting this.
 * Props: { jobId, repoId, mode, startedAt, onComplete, onDismiss }
 */
export default function ScanProgressBanner({ jobId, repoId, mode = 'job', startedAt, onComplete, onDismiss }) {
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [stuck, setStuck] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const startedAtRef = useRef(null);

    useEffect(() => {
        if (mode !== 'inline') return;
        const start = startedAt || Date.now();
        const tick = () => {
            const el = Date.now() - start;
            setElapsedMs(el);
            if (el >= STUCK_THRESHOLD_MS) setStuck(true);
        };
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [mode, startedAt]);

    useEffect(() => {
        if (mode !== 'job' || !jobId) return;

        const poll = async () => {
            try {
                const data = await getJob(jobId);
                setJob(data);
                setNotFound(false);
                if (data.status === 'pending' && !startedAtRef.current) {
                    startedAtRef.current = Date.now();
                }
                if (data.status === 'running' && !startedAtRef.current && data.started_at) {
                    startedAtRef.current = new Date(data.started_at).getTime();
                }
                if (data.status === 'completed') {
                    const reviewId = data.result?.review_id || data.review_id;
                    if (reviewId && typeof onComplete === 'function') onComplete(reviewId);
                }
            } catch (e) {
                const is404 = e?.response?.status === 404 || e?.status === 404;
                const bodyError = e?.response?.data?.error ?? e?.message ?? '';
                if (is404 || (typeof bodyError === 'string' && bodyError.toLowerCase().includes('not found'))) {
                    setNotFound(true);
                }
            } finally {
                setLoading(false);
            }
        };

        poll();
        const interval = setInterval(poll, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [jobId, onComplete]);

    useEffect(() => {
        if (!job || (job.status !== 'pending' && job.status !== 'running')) return;
        const t = setInterval(() => {
            const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
            if (elapsed >= STUCK_THRESHOLD_MS) setStuck(true);
        }, 60000);
        return () => clearInterval(t);
    }, [job?.status]);

    if (mode === 'inline') {
        return (
            <Alert variant="info" className="mb-3">
                {stuck && (
                    <p className="small text-warning mb-2">
                        This scan is taking longer than usual. You can keep this page open or check back later.
                    </p>
                )}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                    <Spinner animation="border" size="sm" />
                    <span>{currentInlineStage(elapsedMs)}</span>
                    <ProgressBar style={{ width: 120, height: 6 }} animated now={100} variant="info" />
                    <span className="text-muted small">{elapsedLabel(elapsedMs)} elapsed</span>
                </div>
                {typeof onDismiss === 'function' && (
                    <div className="mt-2">
                        <Button variant="outline-info" size="sm" onClick={onDismiss}>Dismiss</Button>
                    </div>
                )}
            </Alert>
        );
    }

    if (!jobId) return null;

    if (loading && !job) {
        return (
            <Alert variant="info" className="d-flex align-items-center gap-2 mb-3">
                <Spinner animation="border" size="sm" /> Checking scan status…
            </Alert>
        );
    }

    if (notFound) {
        return (
            <Alert variant="warning" className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                <span>This job is no longer in the queue. Check the latest review for results or run a new scan.</span>
                <Button variant="outline-warning" size="sm" onClick={onDismiss}>Dismiss</Button>
            </Alert>
        );
    }

    const status = job?.status || 'pending';

    if (status === 'completed') {
        // Backend stamps result.scan_status as either 'success' (fresh review)
        // or 'idempotent' (we already had a review for this repo+commit so we
        // returned the existing one). Show different copy + variant so the
        // user understands they're looking at a previous review, not a new one.
        const scanStatus = job?.result?.scan_status;
        const isIdempotent = scanStatus === 'idempotent';
        return (
            <Alert
                variant={isIdempotent ? 'info' : 'success'}
                className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3"
            >
                <span>
                    {isIdempotent
                        ? 'A review already exists for this commit — showing the existing one.'
                        : 'Review ready.'}
                </span>
                <div className="d-flex gap-2">
                    {job?.result?.review_id && (
                        <Button
                            variant={isIdempotent ? 'outline-info' : 'outline-success'}
                            size="sm"
                            onClick={() => onComplete(job.result.review_id)}
                        >
                            {isIdempotent ? 'Open existing review' : 'View review'}
                        </Button>
                    )}
                    <Button
                        variant={isIdempotent ? 'outline-info' : 'outline-success'}
                        size="sm"
                        onClick={onDismiss}
                    >
                        Dismiss
                    </Button>
                </div>
            </Alert>
        );
    }

    if (status === 'failed') {
        return (
            <Alert variant="danger" className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                <div>
                    <strong>Scan failed.</strong>
                    {job?.error && <span className="d-block small mt-1">{job.error}</span>}
                </div>
                <Button variant="outline-danger" size="sm" onClick={onDismiss}>Dismiss</Button>
            </Alert>
        );
    }

    // pending or running
    return (
        <Alert variant="info" className="mb-3">
            {stuck && (
                <p className="small text-warning mb-2">
                    This scan is taking longer than usual. You can keep this page open or run a new scan later.
                </p>
            )}
            <div className="d-flex align-items-center gap-2 flex-wrap">
                {status === 'pending' && <><Spinner animation="border" size="sm" /> Scan queued. It will start shortly.</>}
                {status === 'running' && (
                    <>
                        <Spinner animation="border" size="sm" />
                        <span>Scanning your code… This usually takes 1–3 minutes.</span>
                        <ProgressBar style={{ width: 120, height: 6 }} animated now={100} variant="info" />
                    </>
                )}
            </div>
        </Alert>
    );
}
