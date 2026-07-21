import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DataLoader from './components/DataLoader';
import { apiClient } from './lib/apiClient';

const ReviewsPage = () => {
    const navigate = useNavigate();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState(null);

    const fetchReviews = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get(`/api/reviews`, {
                params: { page: currentPage, limit: 10 }
            });
            // apiClient.js interceptor returns response.data
            const data = response;
            setReviews(Array.isArray(data.reviews) ? data.reviews : []);
            setTotalPages(data.total_pages || 1);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch reviews', err);
            setError(err);
            setLoading(false);
            setReviews([]);
            setTotalPages(1);
        }
    }, [currentPage]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const handleRowClick = (id) => {
        navigate(`/review/${id}`);
    };

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1 className="h3 mb-0" style={{ fontWeight: 700 }}>Code Reviews</h1>
                <Link to="/" className="btn btn-primary px-4 rounded-3 d-flex align-items-center gap-2 shadow-sm">
                    <span>+</span> New Analysis
                </Link>
            </div>

            <DataLoader
                isLoading={loading}
                error={error}
                isEmpty={reviews.length === 0 && !loading && !error}
                onRetry={fetchReviews}
                emptyMessage="No reviews found. Start an analysis to see results here."
                skeletonCount={5}
                skeletonHeight="70px"
            >
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0 align-middle">
                            <thead className="table-light text-muted small text-uppercase">
                                <tr>
                                    <th className="px-4 py-3 border-0">Repository</th>
                                    <th className="py-3 border-0 text-center">Status</th>
                                    <th className="py-3 border-0 text-center">Score</th>
                                    <th className="py-3 border-0">Issues Found</th>
                                    <th className="py-3 border-0">Date</th>
                                    <th className="px-4 py-3 border-0 text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reviews.map((review) => (
                                    <tr key={review.id} style={{ cursor: 'pointer' }} onClick={() => handleRowClick(review.id)}>
                                        <td className="px-4 py-3">
                                            <div className="fw-bold text-dark">{review.repo_name || 'Manual Upload'}</div>
                                            <div className="small text-muted">{review.branch || 'main'}</div>
                                        </td>
                                        <td className="py-3 text-center">
                                            <span className={`badge rounded-pill px-3 py-2 ${review.status === 'completed' ? 'bg-success bg-opacity-10 text-success' :
                                                    review.status === 'failed' ? 'bg-danger bg-opacity-10 text-danger' :
                                                        'bg-warning bg-opacity-10 text-warning'
                                                }`}>
                                                {review.status}
                                            </span>
                                        </td>
                                        <td className="py-3 text-center">
                                            <div className={`h5 mb-0 fw-bold ${(review.overall_health_score || 0) > 7 ? 'text-success' :
                                                    (review.overall_health_score || 0) > 4 ? 'text-warning' : 'text-danger'
                                                }`}>
                                                {review.overall_health_score ?? '-'}
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <span className="text-secondary">{review.findings_count?.total || 0} items detected</span>
                                        </td>
                                        <td className="py-3 text-muted small">
                                            {new Date(review.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-end">
                                            <Link
                                                to={`/review/${review.id}`}
                                                className="btn btn-sm btn-light border rounded-pill px-3"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Details
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="d-flex justify-content-center mt-4 align-items-center gap-3">
                        <button
                            className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            aria-label="Previous page"
                        >
                            &larr; Previous
                        </button>
                        <span className="text-muted small">
                            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                        </span>
                        <button
                            className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            aria-label="Next page"
                        >
                            Next &rarr;
                        </button>
                    </div>
                )}
            </DataLoader>
        </div>
    );
};

export default ReviewsPage;
