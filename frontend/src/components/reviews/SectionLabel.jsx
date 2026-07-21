import React from 'react';

/**
 * Small uppercase eyebrow label used for section headers across the issue
 * detail drawer and the fix preview panel.
 *
 * Props:
 *   accent  optional CSS color string for a 3px-wide left bar (signals section type)
 *   muted   if true, dims the text to a lighter gray (used for sub-labels inside cards)
 */
export default function SectionLabel({ children, accent, muted = false }) {
    return (
        <div
            className="d-inline-flex align-items-center mb-2"
            style={{
                fontSize: muted ? '0.65rem' : '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: muted ? '#9CA3AF' : '#6B7280',
            }}
        >
            {accent && (
                <span
                    aria-hidden
                    style={{
                        display: 'inline-block',
                        width: 3,
                        height: muted ? 10 : 12,
                        background: accent,
                        borderRadius: 2,
                        marginRight: 8,
                    }}
                />
            )}
            {children}
        </div>
    );
}
