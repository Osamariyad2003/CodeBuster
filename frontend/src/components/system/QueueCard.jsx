import React from 'react';
import { Card, ProgressBar } from 'react-bootstrap';
import { FaLayerGroup } from 'react-icons/fa';
import LiveStatusDot from './LiveStatusDot';

const QueueCard = ({ queueName = 'Analysis Jobs', pending = 0, processing = 0, failed = 0 }) => {
    const total = pending + processing;
    const maxCapacity = 100; // Mock capacity for visualization
    const load = Math.min((total / maxCapacity) * 100, 100);

    return (
        <Card className="shadow-sm border-0 h-100">
            <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="d-flex align-items-center gap-2">
                        <div className="bg-light p-2 rounded text-primary">
                            <FaLayerGroup size={18} />
                        </div>
                        <h6 className="mb-0 fw-bold">{queueName}</h6>
                    </div>
                    <LiveStatusDot status={processing > 0 ? 'active' : 'idle'} />
                </div>

                <div className="mb-3">
                    <div className="d-flex justify-content-between text-muted small mb-1">
                        <span>Queue Load</span>
                        <span>{pending} pending</span>
                    </div>
                    <ProgressBar now={load} variant={load > 80 ? 'danger' : 'primary'} style={{ height: 6 }} />
                </div>

                <div className="d-flex justify-content-between align-items-center">
                    <div className="text-center">
                        <div className="h4 mb-0 fw-bold">{processing}</div>
                        <div className="text-muted small" style={{ fontSize: '0.7rem' }}>Active</div>
                    </div>
                    <div className="vr opacity-25"></div>
                    <div className="text-center">
                        <div className="h4 mb-0 fw-bold text-muted">{pending}</div>
                        <div className="text-muted small" style={{ fontSize: '0.7rem' }}>Queued</div>
                    </div>
                    <div className="vr opacity-25"></div>
                    <div className="text-center">
                        <div className="h4 mb-0 fw-bold text-danger">{failed}</div>
                        <div className="text-muted small" style={{ fontSize: '0.7rem' }}>DLQ</div>
                    </div>
                </div>
            </Card.Body>
        </Card>
    );
};

export default QueueCard;
