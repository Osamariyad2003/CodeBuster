import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Table, Badge, Button, Spinner } from 'react-bootstrap';
import { FaArrowLeft, FaCheckCircle, FaClock } from 'react-icons/fa';
import { getRepoReviews } from '../lib/apiClient';
import { useToast } from '../components/ToastProvider';

/**
 * Table of review runs: date, score, grade, commit, trigger (webhook/manual).
 * Route: /repos/:repoId/reviews
 */
export default function ReviewsHistoryPage() {
    const { repoId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [reviews, setReviews] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!repoId) return;
            setLoading(true);
            try {
                const res = await getRepoReviews(repoId, { page: 1, limit: 50 });
                setReviews(res.reviews || []);
                setTotal(res.total ?? 0);
            } catch (e) {
                showToast('Failed to load review history', 'danger');
                setReviews([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [repoId, showToast]);

    const gradeVariant = (g) => (g === 'A' ? 'success' : g === 'B' ? 'primary' : g === 'C' ? 'warning' : 'danger');

    return (
        <Container className="py-4">
            <div className="d-flex align-items-center gap-3 mb-4">
                <Button variant="outline-secondary" size="sm" onClick={() => navigate(`/repos/${repoId}`)}>
                    <FaArrowLeft /> Back to repo
                </Button>
                <h4 className="mb-0">Review history</h4>
                <Button
                    variant="outline-secondary"
                    size="sm"
                    className="ms-auto d-flex align-items-center gap-2"
                    onClick={() => navigate(`/time-travel?repo=${repoId}`)}
                    title="Visualize issue evolution over time"
                >
                    <FaClock size={12} /> Time Travel
                </Button>
            </div>
            {loading ? (
                <div className="text-center py-5">
                    <Spinner animation="border" /> Loading...
                </div>
            ) : reviews.length === 0 ? (
                <div className="text-center py-5 text-muted">
                    No reviews yet. Run a scan from the repository dashboard.
                    <div className="mt-3">
                        <Button variant="primary" onClick={() => navigate(`/repos/${repoId}`)}>
                            Go to dashboard
                        </Button>
                    </div>
                </div>
            ) : (
                <Table hover responsive>
                    <thead className="table-light">
                        <tr>
                            <th>Date</th>
                            <th>Score</th>
                            <th>Grade</th>
                            <th>Commit</th>
                            <th>Trigger</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {reviews.map((r) => (
                            <tr key={r.id}>
                                <td>{r.completed_at ? new Date(r.completed_at).toLocaleString() : new Date(r.created_at).toLocaleString()}</td>
                                <td><strong>{r.overall_health_score ?? '—'}</strong>/100</td>
                                <td><Badge bg={gradeVariant(r.grade)}>{r.grade || '—'}</Badge></td>
                                <td className="font-monospace small">{r.commit_sha ? r.commit_sha.slice(0, 7) : '—'}</td>
                                <td>{r.trigger_type || r.trigger_source || '—'}</td>
                                <td><Badge bg={r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'secondary'}>{r.status}</Badge></td>
                                <td>
                                    <Button variant="link" size="sm" className="p-0" onClick={() => navigate(`/reviews/${r.id}`)}>
                                        <FaCheckCircle /> View
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
        </Container>
    );
}
