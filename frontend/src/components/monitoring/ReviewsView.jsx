import React, { useState, useEffect } from 'react';
import { Table, Badge, Button, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';

export default function ReviewsView({ repoId, repoFullName, onRunScan }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchReviews = async () => {
            if (!repoId) return;
            try {
                setLoading(true);
                setError(null);
                const data = await apiClient.get(`/api/repos/${repoId}/reviews`);
                const list = data?.reviews;
                setReviews(Array.isArray(list) ? list : []);
                if (data?.success === false && data?.error) setError(data.error);
            } catch (err) {
                setError('Failed to fetch reviews');
                setReviews([]);
            } finally {
                setLoading(false);
            }
        };

        fetchReviews();
    }, [repoId]);

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
            </div>
        );
    }

    if (error) {
        return <div className="alert alert-danger">{error}</div>;
    }

    if (reviews.length === 0) {
        const githubUrl = repoFullName ? `https://github.com/${repoFullName}` : 'https://github.com';
        return (
            <div className="empty-state text-center py-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px' }}>
                <div className="mb-4" style={{ fontSize: '3rem' }}>📋</div>
                <h3>No reviews yet</h3>
                <p className="text-muted mb-4">
                    Run a scan to get your first AI review. You can also open a Pull Request on GitHub to trigger a review automatically.
                </p>
                <div className="d-flex flex-wrap justify-content-center gap-2">
                    {typeof onRunScan === 'function' && (
                        <Button variant="primary" onClick={onRunScan}>
                            Run scan
                        </Button>
                    )}
                    <Button variant="outline-primary" onClick={() => window.open(githubUrl, '_blank')}>
                        View on GitHub
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="review-list">
            <h4 className="mb-3" style={{ fontWeight: 600, fontSize: 'clamp(1.1rem, 3vw, 1.25rem)' }}>Recent Reviews</h4>
            <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <Table hover className="align-middle mb-0">
                    <thead className="table-light">
                        <tr>
                            <th className="text-nowrap">PR #</th>
                            <th className="text-nowrap d-none d-md-table-cell">Status</th>
                            <th className="text-nowrap">Health Score</th>
                            <th className="text-nowrap d-none d-lg-table-cell">Created At</th>
                            <th className="text-nowrap">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reviews.map(review => (
                            <tr key={review.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/reviews/${review.id}`)}>
                                <td style={{ fontWeight: 600 }}>#{review.pr_number ?? (review.trigger_type === 'manual' || review.trigger_source === 'manual' ? 'Manual' : '–')}</td>
                                <td className="d-none d-md-table-cell">
                                    <Badge bg={review.status === 'completed' ? 'success' : 'warning'}>
                                        {review.status}
                                    </Badge>
                                </td>
                                <td>
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="progress flex-grow-1" style={{ height: 6, minWidth: 'clamp(40px, 10vw, 60px)' }}>
                                            <div
                                                className={`progress-bar bg-${review.overall_health_score > 70 ? 'success' : review.overall_health_score > 40 ? 'warning' : 'danger'}`}
                                                style={{ width: `${review.overall_health_score || 0}%` }}
                                            />
                                        </div>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                            {review.overall_health_score || 0}/100
                                        </span>
                                    </div>
                                </td>
                                <td className="d-none d-lg-table-cell text-nowrap">
                                    {new Date(review.created_at).toLocaleDateString()}
                                </td>
                                <td>
                                    <Button 
                                        variant="link" 
                                        size="sm" 
                                        className="p-0 text-nowrap"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/reviews/${review.id}`);
                                        }}
                                    >
                                        <span className="d-none d-sm-inline">View Details</span>
                                        <span className="d-sm-none">View</span>
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>
        </div>
    );
}
