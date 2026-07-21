import React, { useState, useEffect } from 'react';
import { Table, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import { FaHistory, FaExternalLinkAlt, FaChevronRight, FaTerminal } from 'react-icons/fa';
import { apiClient } from './lib/apiClient';

const RunHistory = ({ repositoryId, onSelectReview }) => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!repositoryId) return;
            try {
                setLoading(true);
                const data = await apiClient.get(`/api/repos/${repositoryId}/reviews`);
                const list = data?.reviews ?? data;
                setReviews(Array.isArray(list) ? list : []);
                setError(null);
            } catch (err) {
                console.error('History fetch failed:', err);
                setError('Failed to load review history');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [repositoryId]);

    if (loading) return <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>;
    if (error) return <Alert variant="danger">{error}</Alert>;
    if (reviews.length === 0) return (
        <div className="text-center py-4 border rounded bg-light">
            <FaTerminal className="text-muted mb-2" size={24} />
            <p className="text-muted mb-0">No runs found for this project.</p>
        </div>
    );

    return (
        <div className="run-history">
            <div className="d-flex align-items-center gap-2 mb-3">
                <FaHistory className="text-primary" />
                <h6 className="mb-0 fw-bold">Audit History</h6>
            </div>
            <Table responsive hover className="border-0">
                <thead className="bg-light">
                    <tr>
                        <th className="border-0 text-muted small px-3">DATE</th>
                        <th className="border-0 text-muted small px-3">TRIGGER</th>
                        <th className="border-0 text-muted small px-3">DETAILS</th>
                        <th className="border-0 text-muted small px-3 text-center">SCORE</th>
                        <th className="border-0"></th>
                    </tr>
                </thead>
                <tbody>
                    {reviews.map(review => (
                        <tr key={review.id} style={{ cursor: 'pointer' }} onClick={() => onSelectReview(review)}>
                            <td className="px-3">
                                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                                    {new Date(review.created_at).toLocaleDateString()}
                                </div>
                                <small className="text-muted">{new Date(review.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                            </td>
                            <td className="px-3 vertical-align-middle">
                                <Badge
                                    bg={review.trigger_type === 'webhook' ? 'info' : 'secondary'}
                                    className="text-capitalize"
                                    style={{ opacity: 0.8 }}
                                >
                                    {review.trigger_type}
                                </Badge>
                            </td>
                            <td className="px-3">
                                {review.pr_number ? (
                                    <div className="d-flex align-items-center gap-1 text-primary" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                        PR #{review.pr_number}
                                    </div>
                                ) : (
                                    <span className="text-muted small">Manual Scan</span>
                                )}
                                {review.commit_sha && (
                                    <code className="text-muted" style={{ fontSize: '0.75rem' }}>{review.commit_sha.substring(0, 7)}</code>
                                )}
                            </td>
                            <td className="px-3 text-center vertical-align-middle">
                                <div
                                    className="fw-bold"
                                    style={{
                                        color: review.overall_health_score > 80 ? 'var(--color-success)' : review.overall_health_score > 50 ? 'var(--color-warning)' : 'var(--color-danger)',
                                        fontSize: '1rem'
                                    }}
                                >
                                    {review.overall_health_score}
                                </div>
                            </td>
                            <td className="text-end px-3">
                                <FaChevronRight className="text-muted" size={12} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </div>
    );
};

export default RunHistory;
