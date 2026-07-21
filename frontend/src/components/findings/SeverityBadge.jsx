import React from 'react';
import { Badge } from 'react-bootstrap';

const SeverityBadge = ({ severity }) => {
    const getVariant = (s) => {
        switch (s?.toLowerCase()) {
            case 'critical': return 'danger';
            case 'major': return 'warning';
            case 'minor': return 'info';
            case 'info': return 'secondary';
            default: return 'light';
        }
    };

    const getLabel = (s) => s ? s.toUpperCase() : 'UNKNOWN';

    return (
        <Badge
            bg={getVariant(severity)}
            className="fw-bold px-2 py-1"
            style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}
        >
            {getLabel(severity)}
        </Badge>
    );
};

export default SeverityBadge;
