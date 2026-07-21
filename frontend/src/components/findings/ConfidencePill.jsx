import React from 'react';

const ConfidencePill = ({ score }) => {
    // Score is 0-1 or 0-100. Normalize to 0-100.
    const normalizedScore = score <= 1 ? score * 100 : score;

    let color = '#198754'; // Green
    if (normalizedScore < 70) color = '#dc3545'; // Red
    else if (normalizedScore < 90) color = '#fd7e14'; // Orange

    return (
        <div
            className="d-inline-flex align-items-center px-2 py-0 border rounded-pill"
            style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                backgroundColor: `${color}15`, // very light background
                borderColor: `${color}40`,
                color: color
            }}
            title={`AI Confidence: ${normalizedScore}%`}
        >
            <div
                className="rounded-circle me-1"
                style={{ width: 6, height: 6, backgroundColor: color }}
            />
            {Math.round(normalizedScore)}% Conf.
        </div>
    );
};

export default ConfidencePill;
