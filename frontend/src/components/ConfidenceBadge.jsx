import React from 'react';
import { Badge } from 'react-bootstrap';

const ConfidenceBadge = ({ score }) => {
    let variant = 'secondary';
    let label = 'Unknown';

    if (score >= 0.8) {
        variant = 'success';
        label = 'High';
    } else if (score >= 0.5) {
        variant = 'warning';
        label = 'Medium';
    } else {
        variant = 'danger';
        label = 'Low';
    }

    // If score is technically null/undefined but we want to render something
    if (score === null || score === undefined) return null;

    return (
        <Badge bg={variant} pill className="px-3" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
            {label} ({Math.round(score * 100)}%)
        </Badge>
    );
};

export default ConfidenceBadge;
