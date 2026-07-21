import React, { useState, useEffect, useCallback } from 'react';
import { Table, Badge, Button, Modal } from 'react-bootstrap';
import { FaSync, FaCheck, FaTimes, FaClock } from 'react-icons/fa';
import { apiClient } from '../../lib/apiClient';
import { usePolling } from '../../hooks/usePolling';
import { useToast } from '../ToastProvider';
import { SkeletonTable, SkeletonDetail } from '../Skeleton';
import { CopyButton } from '../CopyButton';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function EventsView({ repoFullName }) {
    const { showToast } = useToast();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const fetchEvents = useCallback(async () => {
        try {
            const data = await apiClient.get('/api/events', { params: { repo: repoFullName, limit: 10 } });
            setEvents(data.events || []);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch events:', err);
        }
    }, [repoFullName]);

    const { lastUpdated, refresh } = usePolling(fetchEvents, 10000);

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

    if (loading && events.length === 0) return <SkeletonTable columns={5} rows={5} />;

    return (
        <div className="events-view">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 style={{ fontWeight: 600, margin: 0 }}>Webhook Activity</h5>
                <Button variant="outline-secondary" size="sm" onClick={() => refresh()}>
                    <FaSync className={loading ? 'spinning' : ''} /> Refresh
                </Button>
            </div>

            <div className="table-responsive">
                <Table hover className="align-middle">
                    <thead className="table-light">
                        <tr>
                            <th>Time</th>
                            <th>Delivery ID</th>
                            <th>Event Type</th>
                            <th>Status</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="text-center py-4 text-muted">
                                    No webhook events found for this repository.
                                </td>
                            </tr>
                        ) : (
                            events.map((event, idx) => (
                                <tr key={event.delivery_id || idx} onClick={() => handleRowClick(event)} style={{ cursor: 'pointer' }}>
                                    <td>{new Date(event.timestamp).toLocaleString()}</td>
                                    <td><CopyButton value={event.delivery_id} /></td>
                                    <td><Badge bg="info">{event.event_type}</Badge></td>
                                    <td>{getStatusBadge(event.status)}</td>
                                    <td>{event.reason || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </Table>
            </div>

            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>Event Details</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedEvent ? (
                        <div>
                            <div className="row mb-3">
                                <div className="col-md-6">
                                    <p><strong>Delivery ID:</strong> {selectedEvent.delivery_id}</p>
                                    <p><strong>Status:</strong> {getStatusBadge(selectedEvent.status)}</p>
                                </div>
                                <div className="col-md-6 text-end">
                                    <p><strong>Time:</strong> {new Date(selectedEvent.timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                            {selectedEvent.payload && (
                                <div>
                                    <p><strong>Payload:</strong></p>
                                    <div style={{ maxHeight: 300, overflow: 'auto' }}>
                                        <SyntaxHighlighter language="json" style={oneDark}>
                                            {JSON.stringify(selectedEvent.payload, null, 2)}
                                        </SyntaxHighlighter>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : <SkeletonDetail />}
                </Modal.Body>
            </Modal>
        </div>
    );
}
