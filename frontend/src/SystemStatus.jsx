import React from 'react';
import { Container, Card, Alert, Row, Col, Badge, ProgressBar, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Header from './Header';
import { FaServer, FaDatabase, FaMemory, FaBolt, FaStream, FaArrowRight } from 'react-icons/fa';

const SystemStatus = () => {
    // TODO: Phase 2 - Fetch real system metrics from /api/system/status
    const metrics = {
        redis: 'Connected',
        queue_depth: 0,
        active_workers: 4,
        uptime: '99.9%'
    };

    return (
        <>
            <Container className="py-5" style={{ maxWidth: 1000 }}>
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h1 className="fw-bold mb-0">Diagnostics</h1>
                    <Badge bg="secondary">Phase 2 (Beta)</Badge>
                </div>

                <Row className="g-3 mb-4">
                    <Col md={6}>
                        <Card as={Link} to="/events" className="shadow-sm border-0 h-100 text-decoration-none text-reset">
                            <Card.Body className="d-flex align-items-center">
                                <div style={{
                                    width: 44, height: 44, borderRadius: 10,
                                    background: 'rgba(13,110,253,0.1)', color: '#0d6efd',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginRight: 12
                                }}>
                                    <FaStream size={20} />
                                </div>
                                <div className="flex-grow-1">
                                    <div className="fw-bold">Webhook Events</div>
                                    <div className="small text-muted">Inspect incoming GitHub webhook deliveries</div>
                                </div>
                                <FaArrowRight className="text-muted" />
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={6}>
                        <Card as={Link} to="/jobs" className="shadow-sm border-0 h-100 text-decoration-none text-reset">
                            <Card.Body className="d-flex align-items-center">
                                <div style={{
                                    width: 44, height: 44, borderRadius: 10,
                                    background: 'rgba(25,135,84,0.1)', color: '#198754',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginRight: 12
                                }}>
                                    <FaServer size={20} />
                                </div>
                                <div className="flex-grow-1">
                                    <div className="fw-bold">Jobs Queue</div>
                                    <div className="small text-muted">Monitor background workers and queued jobs</div>
                                </div>
                                <FaArrowRight className="text-muted" />
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                <Alert variant="info" className="mb-4">
                    <FaBolt className="me-2" />
                    This dashboard is currently under development. Real-time metrics coming soon.
                </Alert>

                <Row className="g-4">
                    <Col md={6}>
                        <Card className="shadow-sm border-0 h-100">
                            <Card.Body>
                                <h5 className="card-title text-muted mb-3"><FaDatabase className="me-2" />Redis Status</h5>
                                <div className="d-flex align-items-center gap-2">
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success-green)' }}></div>
                                    <span className="fw-bold">{metrics.redis}</span>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={6}>
                        <Card className="shadow-sm border-0 h-100">
                            <Card.Body>
                                <h5 className="card-title text-muted mb-3"><FaServer className="me-2" />Active Workers</h5>
                                <h2 className="fw-bold">{metrics.active_workers}</h2>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={12}>
                        <Card className="shadow-sm border-0">
                            <Card.Body>
                                <h5 className="card-title text-muted mb-3"><FaMemory className="me-2" />Queue Health</h5>
                                <ProgressBar now={10} label={`${10}%`} variant="success" className="mb-2" style={{ height: 20 }} />
                                <small className="text-muted">Current Load</small>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </>
    );
};

export default SystemStatus;
