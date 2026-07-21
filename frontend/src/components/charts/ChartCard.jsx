import React from 'react';
import { Card, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaInfoCircle } from 'react-icons/fa';
import Skeleton from '../Skeleton';

const ChartCard = ({ title, tooltip, loading, children, height = 300, headerRight }) => {
    return (
        <Card className="h-100 shadow-sm" style={{ border: '1px solid var(--border-subtle, #e9ecef)', borderRadius: '12px' }}>
            <Card.Header
                className="d-flex align-items-center justify-content-between bg-transparent border-bottom"
                style={{ padding: '12px 16px' }}
            >
                <div className="d-flex align-items-center gap-2">
                    <span className="fw-bold" style={{ fontSize: '0.95rem' }}>{title}</span>
                    {tooltip && (
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>{tooltip}</Tooltip>}
                        >
                            <span style={{ cursor: 'help', color: 'var(--text-muted)' }}>
                                <FaInfoCircle size={13} />
                            </span>
                        </OverlayTrigger>
                    )}
                </div>
                {headerRight && <div className="d-flex align-items-center gap-1">{headerRight}</div>}
            </Card.Header>
            <Card.Body style={{ padding: '16px' }}>
                {loading ? (
                    <Skeleton height={`${height}px`} />
                ) : (
                    children
                )}
            </Card.Body>
        </Card>
    );
};

export default ChartCard;
