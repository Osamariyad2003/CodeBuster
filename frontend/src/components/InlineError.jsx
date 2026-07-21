import React from 'react';
import { Alert, Button } from 'react-bootstrap';
import { FaExclamationTriangle, FaRedo } from 'react-icons/fa';

export const InlineError = ({ message, onRetry }) => {
    return (
        <Alert variant="danger" className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-3">
                <FaExclamationTriangle size={24} />
                <div>
                    <h6 className="mb-0 fw-bold">Something went wrong</h6>
                    <p className="mb-0 small">{message}</p>
                </div>
            </div>
            {onRetry && (
                <Button variant="outline-danger" size="sm" onClick={onRetry}>
                    <FaRedo className="me-2" />
                    Retry
                </Button>
            )}
        </Alert>
    );
};
