import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Form, Modal, Spinner, Dropdown } from 'react-bootstrap';
import { FaSync, FaFilter, FaSearch, FaExternalLinkAlt, FaCheck, FaTimes, FaClock, FaPlay, FaPause, FaHistory } from 'react-icons/fa';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
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

const EventsPage = () => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { showToast } = useToast();
    const { get, set, getCacheKey, persist, retrieve } = useCache(30000); // 30s cache

    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [polling, setPolling] = useState(false);
    const [pollingInterval, setPollingInterval] = useState(10000);
    const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 0 });

    const [filters, setFilters] = useState({
        repo: searchParams.get('repo') || retrieve('last_repo_filter') || '',
        eventType: searchParams.get('eventType') || '',
        status: searchParams.get('status') || '',
        deliveryId: searchParams.get('deliveryId') || ''
    });

    // Persist repo filter changes
    useEffect(() => {
        if (filters.repo) {
            persist('last_repo_filter', filters.repo);
        }
    }, [filters.repo, persist]);

    const fetchEvents = useCallback(async (isManual = false) => {
        const queryParams = {
            ...filters,
            page: pagination.page,
            limit: pagination.limit
        };

        const cacheKey = getCacheKey('/api/events', queryParams);
        const cachedData = get(cacheKey);

        if (cachedData && !isManual) {
            setEvents(cachedData.events);
            setPagination(prev => ({ ...prev, total: cachedData.total, totalPages: cachedData.totalPages }));
            setLoading(false);
            return;
        }

        try {
            const response = await apiClient.get('/api/events', { params: queryParams });
            const data = response.data || response; // Handle both direct array and wrapped response
            const items = data.events || [];
            setEvents(items);
            setPagination(prev => ({
                ...prev,
                total: data.total || items.length,
                totalPages: data.totalPages || Math.ceil((data.total || items.length) / pagination.limit)
            }));
            set(cacheKey, data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch events:', err);
            // Don't show global toast for partial failures, let InlineError handle it
            setError(err.userMessage || 'Failed to load events. Please check your connection.');
        } finally {
            setLoading(false);
        }
    }, [filters, pagination.page, pagination.limit, get, set, getCacheKey, showToast]);

    const { lastUpdated, refresh } = usePolling(fetchEvents, pollingInterval, polling);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const handleRowClick = async (event) => {
        try {
            const data = await apiClient.get(`/api/events/${event.delivery_id}`);
            setSelectedEvent(data.data || data);
            setShowModal(true);
        } catch (err) {
            showToast('Failed to fetch event details', 'danger');
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            accepted: { bg: 'success', icon: <FaCheck /> },
            ignored: { bg: 'secondary', icon: <FaTimes /> },
            failed: { bg: 'danger', icon: <FaTimes /> },
            pending: { bg: 'warning', icon: <FaClock /> }
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

    return (
        <>
            <Container className="py-4" style={{ maxWidth: 1400 }}>
                {/* Page Header */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                            Webhook Events
                        </h1>
                        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                            Monitor GitHub webhook ingestion pipeline
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
                            <Col md={3}>
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
                            <Col md={2}>
                                <Form.Group>
                                    <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                        Event Type
                                    </Form.Label>
                                    <Form.Select
                                        value={filters.eventType}
                                        onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                                        style={{ borderRadius: 8 }}
                                    >
                                        <option value="">All</option>
                                        <option value="pull_request">Pull Request</option>
                                        <option value="push">Push</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={2}>
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
                                        <option value="accepted">Accepted</option>
                                        <option value="ignored">Ignored</option>
                                        <option value="failed">Failed</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                        <FaSearch className="me-1" /> Delivery ID
                                    </Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search by delivery ID"
                                        value={filters.deliveryId}
                                        onChange={(e) => setFilters({ ...filters, deliveryId: e.target.value })}
                                        style={{ borderRadius: 8 }}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={2}>
                                <Button
                                    variant="secondary"
                                    onClick={() => setFilters({ repo: '', eventType: '', status: '', deliveryId: '' })}
                                    style={{ borderRadius: 8, width: '100%' }}
                                >
                                    Clear Filters
                                </Button>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Events Table */}
                <Card style={{ border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
                    <Card.Body className="p-0">
                        {loading && events.length === 0 ? (
                            <div className="p-4">
                                <SkeletonTable columns={8} rows={10} />
                            </div>
                        ) : error ? (
                            <div className="p-4">
                                <InlineError
                                    message={error}
                                    onRetry={() => fetchEvents(true)}
                                />
                            </div>
                        ) : events.length === 0 ? (
                            <div className="text-center py-5 text-muted">
                                No webhook events found. Push code or open a PR to see events here.
                            </div>
                        ) : (
                            <>
                                <Table hover responsive className="mb-0" style={{ fontSize: '0.875rem' }}>
                                    <thead style={{ background: 'var(--light-gray)' }}>
                                        <tr>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Time</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Delivery ID</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Event</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Repository</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Action</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Status</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Jobs</th>
                                            <th style={{ padding: '14px 16px', fontWeight: 600 }}>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {events.map((event, idx) => (
                                            <tr
                                                key={event.delivery_id || idx}
                                                onClick={() => handleRowClick(event)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td style={{ padding: '12px 16px' }}>{formatTime(event.timestamp)}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <CopyButton value={event.delivery_id} />
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <Badge bg="info" style={{ fontSize: '0.75rem' }}>{event.event_type}</Badge>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>{event.repo}</td>
                                                <td style={{ padding: '12px 16px' }}>{event.action || '-'}</td>
                                                <td style={{ padding: '12px 16px' }}>{getStatusBadge(event.status)}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <Button
                                                        variant="link"
                                                        size="sm"
                                                        className="p-0 d-flex align-items-center gap-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/jobs?deliveryId=${event.delivery_id}`);
                                                        }}
                                                    >
                                                        <FaHistory size={12} /> View
                                                    </Button>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{event.reason || '-'}</td>
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

                {/* Event Details Modal */}
                <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
                    <Modal.Header closeButton style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <Modal.Title style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                            Event Details
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {selectedEvent ? (
                            <div>
                                <Row className="mb-3">
                                    <Col md={6}>
                                        <p><strong>Delivery ID:</strong></p>
                                        <code style={{ fontSize: '0.85rem' }}>{selectedEvent.delivery_id}</code>
                                    </Col>
                                    <Col md={6}>
                                        <p><strong>Status:</strong></p>
                                        {getStatusBadge(selectedEvent.status)}
                                    </Col>
                                </Row>
                                <Row className="mb-3">
                                    <Col md={4}>
                                        <p><strong>Event Type:</strong></p>
                                        <Badge bg="info">{selectedEvent.event_type}</Badge>
                                    </Col>
                                    <Col md={4}>
                                        <p><strong>Repository:</strong></p>
                                        <span>{selectedEvent.repo}</span>
                                    </Col>
                                    <Col md={4}>
                                        <p><strong>Action:</strong></p>
                                        <span>{selectedEvent.action || 'N/A'}</span>
                                    </Col>
                                </Row>
                                <Row className="mb-3">
                                    <Col md={6}>
                                        <p><strong>Received At:</strong></p>
                                        <span>{formatTime(selectedEvent.timestamp)}</span>
                                    </Col>
                                    <Col md={6}>
                                        <p><strong>Reason:</strong></p>
                                        <span>{selectedEvent.reason || 'N/A'}</span>
                                    </Col>
                                </Row>
                                {selectedEvent.payload && (
                                    <div>
                                        <p><strong>Payload Preview:</strong></p>
                                        <div style={{ maxHeight: 300, overflow: 'auto', borderRadius: 8 }}>
                                            <SyntaxHighlighter language="json" style={oneDark} customStyle={{ fontSize: '0.8rem', borderRadius: 8 }}>
                                                {JSON.stringify(selectedEvent.payload, null, 2)}
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

export default EventsPage;
