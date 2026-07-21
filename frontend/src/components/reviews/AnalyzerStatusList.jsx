import React from 'react';
import { ListGroup, Spinner, ProgressBar, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaCheck, FaExclamationCircle, FaClock, FaMinusCircle } from 'react-icons/fa';

/**
 * Renders list of analyzers with status: pending → spinner, running → progress, completed → check + duration/findings, failed → error + tooltip, skipped → gray.
 * Data: commit_review.analyzers[] or legacy { analyzers_run: string[], by_tool: { [id]: number } }.
 * Props: { analyzers: Array<{ id, name, status, duration_ms?, stats?: { findings?, files_scanned? }, error? }> | { analyzers_run: string[], by_tool: object } }
 */
export default function AnalyzerStatusList({ analyzers }) {
    let list = [];

    if (Array.isArray(analyzers)) {
        list = analyzers.map((a) => ({
            id: a.id || a.name,
            name: a.name || (a.id && a.id.replace(/_/g, ' ')) || a.id || '—',
            status: a.status || 'pending',
            duration_ms: a.duration_ms,
            findings: a.stats?.findings,
            files_scanned: a.stats?.files_scanned,
            error: a.error,
        }));
    } else if (analyzers && Array.isArray(analyzers.analyzers_run)) {
        const byTool = analyzers.by_tool || {};
        list = analyzers.analyzers_run.map((id) => ({
            id,
            name: id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            status: 'completed',
            findings: byTool[id],
        }));
    }

    if (list.length === 0) {
        return (
            <div className="text-muted small py-3">
                No analyzer data.
            </div>
        );
    }

    const statusIcon = (status) => {
        switch (status) {
            case 'pending':
                return <Spinner animation="border" size="sm" className="text-secondary" />;
            case 'running':
                return <ProgressBar style={{ width: 24, height: 6 }} animated now={100} variant="primary" />;
            case 'completed':
                return <FaCheck className="text-success" />;
            case 'failed':
                return <FaExclamationCircle className="text-danger" />;
            case 'skipped':
                return <FaMinusCircle className="text-secondary" />;
            default:
                return <FaClock className="text-secondary" />;
        }
    };

    return (
        <ListGroup variant="flush">
            {list.map((a) => (
                <ListGroup.Item key={a.id} className="d-flex align-items-center gap-3 py-2">
                    <div className="flex-shrink-0" style={{ width: 24 }}>
                        {a.status === 'failed' && a.error ? (
                            <OverlayTrigger placement="top" overlay={<Tooltip>{a.error}</Tooltip>}>
                                <span>{statusIcon(a.status)}</span>
                            </OverlayTrigger>
                        ) : (
                            statusIcon(a.status)
                        )}
                    </div>
                    <span className="flex-grow-1">{a.name}</span>
                    {a.findings != null && (
                        <span className="small text-muted">{a.findings} finding{a.findings !== 1 ? 's' : ''}</span>
                    )}
                    {a.duration_ms != null && (
                        <span className="small text-muted">{(a.duration_ms / 1000).toFixed(1)}s</span>
                    )}
                </ListGroup.Item>
            ))}
        </ListGroup>
    );
}
