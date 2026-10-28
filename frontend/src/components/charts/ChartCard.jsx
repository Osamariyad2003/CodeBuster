import React from 'react';
import { Card, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaInfoCircle } from 'react-icons/fa';
import Skeleton from '../Skeleton';

const ChartCard = ({ title, tooltip, loading, children, height = 300, headerRight }) => {
    return (
        <Card className="h-100 shadow-sm" style={{ background: 'var(--surface-card, #0E1118)', border: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))', borderRadius: '12px' }}>
            <Card.Header
                className="d-flex align-items-center justify-content-between bg-transparent border-bottom"
                style={{ padding: '12px 16px', borderColor: 'var(--border-subtle, rgba(255, 255, 255, 0.05))' }}
            >
                <div className="d-flex align-items-center gap-2">
                    <span className="fw-bold" style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{title}</span>
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
