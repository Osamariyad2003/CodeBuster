import React from 'react';
import { Card, Badge } from 'react-bootstrap';
import { FaServer, FaMicrochip } from 'react-icons/fa';
import LiveStatusDot from './LiveStatusDot';

const WorkerCard = ({ workerId, status = 'idle', currentJob = null }) => {
    return (
        <Card className="shadow-sm border-0 h-100">
            <Card.Body className="p-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2">
                        <FaServer className="text-muted" />
                        <span className="fw-bold small">{workerId}</span>
                    </div>
                    <LiveStatusDot status={status === 'busy' ? 'busy' : 'idle'} />
                </div>

                <div className="mb-2">
                    <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.65rem' }}>Current Task</div>
                    <div className="text-truncate fw-medium" title={currentJob}>
                        {currentJob || <span className="text-muted fst-italic">Waiting for jobs...</span>}
                    </div>
                </div>

                <div className="d-flex gap-2 mt-3">
                    <Badge bg="light" text="dark" className="border font-monospace">
                        CPU: {Math.floor(Math.random() * 30) + 10}%
                    </Badge>
                    <Badge bg="light" text="dark" className="border font-monospace">
                        MEM: {Math.floor(Math.random() * 200) + 100}MB
                    </Badge>
                </div>
            </Card.Body>
        </Card>
    );
};

export default WorkerCard;
