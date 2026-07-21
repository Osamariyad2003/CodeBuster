import React, { useState } from 'react';
import { Button, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { FaCopy, FaCheck } from 'react-icons/fa';

export const CopyButton = ({ value, displayValue, truncate = true }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const textToDisplay = displayValue || (truncate ? `${value.slice(0, 8)}...` : value);

    return (
        <div className="d-flex align-items-center gap-2">
            <code style={{ fontSize: '0.8rem' }}>{textToDisplay}</code>
            <OverlayTrigger
                placement="top"
                overlay={<Tooltip>{copied ? 'Copied!' : 'Copy to clipboard'}</Tooltip>}
            >
                <Button
                    variant="link"
                    className="p-0 text-muted"
                    onClick={handleCopy}
                    style={{ height: 'auto', lineHeight: 1 }}
                >
                    {copied ? <FaCheck className="text-success" size={12} /> : <FaCopy size={12} />}
                </Button>
            </OverlayTrigger>
        </div>
    );
};
