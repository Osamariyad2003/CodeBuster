import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Form, Modal, Spinner, ProgressBar, Dropdown, Alert } from 'react-bootstrap';
import { FaSync, FaFilter, FaPlay, FaPause, FaRedo, FaCheck, FaTimes, FaClock, FaSpinner, FaExternalLinkAlt } from 'react-icons/fa';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiClient } from './lib/apiClient';
import { usePolling } from './hooks/usePolling';
import { useCache } from './hooks/useCache';
import { useToast } from './components/ToastProvider';
import { SkeletonTable, SkeletonDetail } from './components/Skeleton';
import { InlineError } from './components/InlineError';
import { CopyButton } from './components/CopyButton';
import { Pagination } from './components/Pagination';

const JobsPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showToast } = useToast();
    const { get, set, getCacheKey, persist, retrieve } = useCache(30000);

    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [polling, setPolling] = useState(false);
    const [pollingInterval, setPollingInterval] = useState(10000);
    const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 0 });

    const [filters, setFilters] = useState({
        repo: searchParams.get('repo') || retrieve('last_repo_filter') || '',
        status: searchParams.get('status') || '',
        deliveryId: searchParams.get('deliveryId') || ''
    });

    // Persist repo filter changes
    useEffect(() => {
        if (filters.repo) {
            persist('last_repo_filter', filters.repo);
        }
    }, [filters.repo, persist]);

    // Optimistic Progress Simulation
    useEffect(() => {
        let interval;
        if (selectedJob && selectedJob.status === 'running' && showModal) {
            interval = setInterval(() => {
                setSelectedJob(prev => {
                    if (!prev || prev.status !== 'running' || prev.progress >= 95) return prev;
                    return { ...prev, progress: (prev.progress || 50) + 5 };
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [selectedJob, showModal]);

    const fetchJobs = useCallback(async (isManual = false) => {
        const queryParams = {
            ...filters,
            page: pagination.page,
            limit: pagination.limit
        };

        const cacheKey = getCacheKey('/api/jobs', queryParams);
        const cachedData = get(cacheKey);

        if (cachedData && !isManual) {
            setJobs(cachedData.jobs);
            setPagination(prev => ({ ...prev, total: cachedData.total, totalPages: cachedData.totalPages }));
            setLoading(false);
            return;
        }

        try {
            const response = await apiClient.get('/api/jobs', { params: queryParams });
            const data = response.data || response;
            const items = data.jobs || [];
            setJobs(items);
            setPagination(prev => ({
                ...prev,
                total: data.total || items.length,
                totalPages: data.totalPages || Math.ceil((data.total || items.length) / pagination.limit)
            }));
            set(cacheKey, data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
            setError(err.userMessage || 'Failed to load jobs');
        } finally {
            setLoading(false);
        }
    }, [filters, pagination.page, pagination.limit, get, set, getCacheKey, showToast]);

    const { lastUpdated, refresh } = usePolling(fetchJobs, pollingInterval, polling);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const handleRowClick = async (job) => {
        try {
            const data = await apiClient.get(`/api/jobs/${job.job_id}`);
            setSelectedJob(data?.data ?? data ?? job);
            setShowModal(true);
        } catch (err) {
            if (err?.status === 404) {
                setSelectedJob({ ...job, _notFound: true, error: 'Job not found or no longer in cache.' });
                setShowModal(true);
            } else {
                showToast('Failed to fetch job details', 'danger');
            }
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            completed: { bg: 'success', icon: <FaCheck /> },
            running: { bg: 'primary', icon: <FaSpinner className="spinning" /> },
            pending: { bg: 'warning', icon: <FaClock /> },
            failed: { bg: 'danger', icon: <FaTimes /> },
            retrying: { bg: 'info', icon: <FaRedo /> }
        };
        const config = variants[status] || variants.pending;
        return (
            <Badge bg={config.bg} className="d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                {config.icon} {status}
            </Badge>
        );
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleString();
    };

    const formatDuration = (ms) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    return (
        <>
            <Container className="py-4" style={{ maxWidth: 1400 }}>
                {/* Page Header */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                            Analysis Jobs
                        </h1>
                        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                            Monitor Celery worker pipeline and job status
                        </p>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                        {lastUpdated && (
                            <span className="text-muted small d-none d-md-block">
                                Last synced: {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                        <Dropdown>
                            <Dropdown.Toggle variant="outline-secondary" size="sm" style={{ borderRadius: 8 }}>
                                Polling: {pollingInterval / 1000}s
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                                {[5, 10, 30, 60].map(s => (
                                    <Dropdown.Item key={s} onClick={() => setPollingInterval(s * 1000)}>
                                        {s}s
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown>
                        <Button
                            variant={polling ? 'success' : 'outline-secondary'}
                            onClick={() => setPolling(!polling)}
                            className="d-flex align-items-center gap-2"
                            style={{ borderRadius: 8 }}
                        >
                            {polling ? <FaPause /> : <FaPlay />}
                            {polling ? 'Live' : 'Start Polling'}
                        </Button>
                        <Button
                            variant="outline-primary"
                            onClick={() => refresh()}
                            disabled={loading}
                            className="d-flex align-items-center gap-2"
                            style={{ borderRadius: 8 }}
                        >
                            <FaSync className={loading ? 'spinning' : ''} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <Card className="mb-4" style={{ border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
                    <Card.Body className="py-3">
                        <Row className="g-3 align-items-end">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                        <FaFilter className="me-1" /> Repository
                                    </Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder="owner/repo"
                                        value={filters.repo}
                                        onChange={(e) => setFilters({ ...filters, repo: e.target.value })}
                                        style={{ borderRadius: 8 }}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                        Status
                                    </Form.Label>
                                    <Form.Select
                                        value={filters.status}
                                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                        style={{ borderRadius: 8 }}
                                    >
                                        <option value="">All</option>
                                        <option value="pending">Pending</option>
                                        <option value="running">Running</option>
                                        <option value="completed">Completed</option>
                                        <option value="failed">Failed</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={2}>
                                <Button
                                    variant="secondary"
                                    onClick={() => setFilters({ repo: '', status: '' })}
                                    style={{ borderRadius: 8, width: '100%' }}
                                >
                                    Clear
                                </Button>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Jobs Table */}
                <Card style={{ border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
                    <Card.Body className="p-0">
                        {loading && jobs.length === 0 ? (
                            <div className="p-4">
                                <SkeletonTable columns={7} rows={10} />
                            </div>
                        ) : error ? (
                            <div className="p-4">
                                <InlineError
                                    message={error}
                                    onRetry={() => fetchJobs(true)}
                                />
                            </div>
                        ) : jobs.length === 0 ? (
                            <div className="text-center py-5 text-muted">
                                No analysis jobs found. Trigger a webhook event to start processing.
                            </div>
                        ) : (
                            <>
                                <Table hover responsive className="mb-0" style={{ fontSize: '0.875rem' }}>
                                    <thead style={{ background: 'var(--light-gray)' }}>
                                        <tr>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Time</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Job ID</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Delivery ID</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Repository</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Status</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Retries</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {jobs.map((job, idx) => (
                                            <tr
                                                key={job.job_id || idx}
                                                onClick={() => handleRowClick(job)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td style={{ padding: '12px 16px' }}>{formatTime(job.started_at)}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <CopyButton value={job.job_id} />
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {job.delivery_id ? (
                                                        <div className="d-flex align-items-center gap-2">
                                                            <CopyButton value={job.delivery_id} />
                                                            <Button
                                                                variant="link"
                                                                size="sm"
                                                                className="p-0"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigate(`/events?deliveryId=${job.delivery_id}`);
                                                                }}
                                                            >
                                                                <FaExternalLinkAlt size={10} />
                                                            </Button>
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>{job.repo}</td>
                                                <td style={{ padding: '12px 16px' }}>{getStatusBadge(job.status)}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{job.retries || 0}</td>
                                                <td style={{ padding: '12px 16px' }}>{formatDuration(job.duration_ms)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                                <div className="py-3 border-top">
                                    <Pagination
                                        currentPage={pagination.page}
                                        totalPages={pagination.totalPages}
                                        onPageChange={(p) => setPagination({ ...pagination, page: p })}
                                    />
                                </div>
                            </>
                        )}
                    </Card.Body>
                </Card>

                {/* Job Details Modal */}
                <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
                    <Modal.Header closeButton style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <Modal.Title style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                            Job Details
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {selectedJob ? (
                            <div>
                                {selectedJob._notFound && (
                                    <Alert variant="info" className="mb-3">Job not found or no longer in cache. Inline scans and expired jobs are not stored in the queue.</Alert>
                                )}
                                <Row className="mb-3">
                                    <Col md={6}>
                                        <p><strong>Job ID:</strong></p>
                                        <code style={{ fontSize: '0.85rem' }}>{selectedJob.job_id}</code>
                                    </Col>
                                    <Col md={6}>
                                        <p><strong>Status:</strong></p>
                                        {getStatusBadge(selectedJob.status)}
                                    </Col>
                                </Row>
                                <Row className="mb-3">
                                    <Col md={4}>
                                        <p><strong>Repository:</strong></p>
                                        <span>{selectedJob.repo}</span>
                                    </Col>
                                    <Col md={4}>
                                        <p><strong>Delivery ID:</strong></p>
                                        <code style={{ fontSize: '0.8rem' }}>{selectedJob.delivery_id || 'N/A'}</code>
                                    </Col>
                                    <Col md={4}>
                                        <p><strong>Retries:</strong></p>
                                        <span>{selectedJob.retries || 0}</span>
                                    </Col>
                                </Row>
                                <Row className="mb-3">
                                    <Col md={4}>
                                        <p><strong>Started At:</strong></p>
                                        <span>{formatTime(selectedJob.started_at)}</span>
                                    </Col>
                                    <Col md={4}>
                                        <p><strong>Completed At:</strong></p>
                                        <span>{formatTime(selectedJob.completed_at)}</span>
                                    </Col>
                                    <Col md={4}>
                                        <p><strong>Duration:</strong></p>
                                        <span>{formatDuration(selectedJob.duration_ms)}</span>
                                    </Col>
                                </Row>
                                {selectedJob.status === 'running' && (
                                    <div className="mb-3">
                                        <p><strong>Progress:</strong></p>
                                        <ProgressBar animated now={selectedJob.progress || 50} label={`${selectedJob.progress || 50}%`} />
                                    </div>
                                )}
                                {selectedJob.error && (
                                    <div className="mb-3">
                                        <p><strong>Error:</strong></p>
                                        <div style={{ background: 'rgba(220, 53, 69, 0.1)', padding: 12, borderRadius: 8, color: 'var(--danger-red)' }}>
                                            {selectedJob.error}
                                        </div>
                                    </div>
                                )}
                                {selectedJob.result && (
                                    <div>
                                        <p><strong>Result:</strong></p>
                                        <div style={{ maxHeight: 200, overflow: 'auto', borderRadius: 8 }}>
                                            <SyntaxHighlighter language="json" style={oneDark} customStyle={{ fontSize: '0.8rem', borderRadius: 8 }}>
                                                {JSON.stringify(selectedJob.result, null, 2)}
                                            </SyntaxHighlighter>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <SkeletonDetail />
                        )}
                    </Modal.Body>
                </Modal>
            </Container >

            <style>{`
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </>
    );
};

export default JobsPage;
