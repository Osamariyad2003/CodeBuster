import React, { useState, useEffect } from 'react';
import { Table, Spinner, Badge, Button } from 'react-bootstrap';
import { FaGithub, FaUser, FaCalendarAlt, FaSearch } from 'react-icons/fa';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../ToastProvider';

export default function CommitsView({ repoId, onScanTriggered, onRunScanForCommit }) {
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reviewingSha, setReviewingSha] = useState(null);
    const { showToast } = useToast();

    useEffect(() => {
        const fetchCommits = async () => {
            try {
                setLoading(true);
                const response = await apiClient.get(`/api/repos/${repoId}/commits`);
                if (response.success) {
                    setCommits(response.commits || []);
                    if (response.commits && response.commits.length === 0) {
                        // Don't show error for empty commits, just display empty state
                        console.log('No commits found for this repository');
                    }
                } else {
                    // Only show error if we got a response but it failed
                    if (response.error) {
                        showToast(response.error, 'warning');
                    }
                    setCommits([]); // Set empty array so UI shows empty state
                }
            } catch (err) {
                console.error('Error fetching commits:', err);
                showToast('Failed to fetch commits. Please try again or reconnect the repository.', 'warning');
                setCommits([]); // Set empty array on error
            } finally {
                setLoading(false);
            }
        };

        if (repoId) {
            fetchCommits();
        }
    }, [repoId, showToast]);

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2">Loading commits...</p>
            </div>
        );
    }

    const handleReviewCommit = async (commit) => {
        if (!repoId || !commit?.sha) return;
        setReviewingSha(commit.sha);
        try {
            if (typeof onRunScanForCommit === 'function') {
                await onRunScanForCommit(commit.sha);
                if (typeof onScanTriggered === 'function') onScanTriggered(commit.sha);
            } else {
                const response = await apiClient.post(`/api/repos/${repoId}/scan`, { commit_sha: commit.sha });
                if (response?.success) {
                    showToast(`Review started for commit ${commit.sha.substring(0, 7)}. Results will appear in Scan result.`, 'success');
                    if (typeof onScanTriggered === 'function') onScanTriggered(commit.sha);
                } else {
                    showToast(response?.message || response?.error || 'Failed to start review', 'danger');
                }
            }
        } catch (err) {
            showToast(err?.message || err?.userMessage || 'Failed to start review', 'danger');
        } finally {
            setReviewingSha(null);
        }
    };

    if (commits.length === 0) {
        return (
            <div className="text-center py-5 text-muted">
                <FaGithub size={48} className="mb-3 opacity-50" />
                <p className="mb-1">No commits found for this repository.</p>
                <p className="small">
                    If this is unexpected, try reconnecting the repository or check your GitHub App permissions.
                </p>
            </div>
        );
    }

    return (
        <div className="commits-view">
            <h5 className="mb-4">Recent Commits</h5>
            <div className="table-responsive">
                <Table hover className="align-middle">
                    <thead className="table-light">
                        <tr>
                            <th>Message</th>
                            <th>Author</th>
                            <th>Date</th>
                            <th>SHA</th>
                            <th className="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {commits.map((commit) => (
                            <tr key={commit.sha}>
                                <td>
                                    <div className="fw-bold text-truncate" style={{ maxWidth: '400px' }}>
                                        {commit.commit.message.split('\n')[0]}
                                    </div>
                                </td>
                                <td>
                                    <div className="d-flex align-items-center gap-2">
                                        {commit.author?.avatar_url ? (
                                            <img
                                                src={commit.author.avatar_url}
                                                alt={commit.commit.author.name}
                                                className="rounded-circle"
                                                width="24"
                                                height="24"
                                            />
                                        ) : (
                                            <FaUser className="text-muted" />
                                        )}
                                        <span>{commit.commit.author.name}</span>
                                    </div>
                                </td>
                                <td>
                                    <div className="text-muted small">
                                        <FaCalendarAlt className="me-1" />
                                        {new Date(commit.commit.author.date).toLocaleDateString()}
                                    </div>
                                </td>
                                <td>
                                    <Badge bg="light" text="dark" className="border">
                                        <code>{commit.sha.substring(0, 7)}</code>
                                    </Badge>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="ms-2 p-0"
                                        onClick={(e) => { e.stopPropagation(); window.open(commit.html_url, '_blank'); }}
                                    >
                                        <FaGithub />
                                    </Button>
                                </td>
                                <td className="text-end">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        className="d-inline-flex align-items-center gap-1"
                                        disabled={reviewingSha === commit.sha}
                                        onClick={(e) => { e.stopPropagation(); handleReviewCommit(commit); }}
                                    >
                                        {reviewingSha === commit.sha ? (
                                            <><Spinner animation="border" size="sm" /> Reviewing…</>
                                        ) : (
                                            <><FaSearch /> Review</>
                                        )}
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
