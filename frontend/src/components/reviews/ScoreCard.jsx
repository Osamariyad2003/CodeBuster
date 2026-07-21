import React from 'react';
import { Card } from 'react-bootstrap';

/**
 * Single metric card for dashboard (overall score, confidence avg, critical count, last scan).
 * Props: { label, value, subValue?, variant?: 'primary'|'success'|'warning'|'danger', icon: ReactNode }
 */
export default function ScoreCard({ label, value, subValue, variant = 'primary', icon }) {
    const variantClass = variant ? `border-${variant} bg-${variant} bg-opacity-10` : '';
    return (
        <Card className={`h-100 ${variantClass}`} style={{ borderLeftWidth: '4px' }}>
            <Card.Body className="d-flex align-items-center gap-3">
                {icon && <div className="flex-shrink-0">{icon}</div>}
                <div>
                    <div className="small text-muted text-uppercase fw-semibold">{label}</div>
                    <div className="fs-4 fw-bold">{value}</div>
                    {subValue != null && <div className="small text-muted">{subValue}</div>}
                </div>
            </Card.Body>
        </Card>
    );
}
