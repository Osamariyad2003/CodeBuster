import React from 'react';
import { Form } from 'react-bootstrap';

/**
 * Dropdown to switch between review runs (by date, score, trigger).
 * Props: { reviews: Array<{ id, created_at, overall_health_score, grade?, trigger_type? }>, value: reviewId, onChange: (id) => void }
 */
export default function ReviewRunSelector({ reviews = [], value, onChange }) {
    if (!reviews.length) return null;
    return (
        <Form.Select
            size="sm"
            style={{ maxWidth: 280 }}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        >
            <option value="">Select a review run...</option>
            {reviews.map((r) => (
                <option key={r.id} value={r.id}>
                    {r.completed_at ? new Date(r.completed_at).toLocaleString() : r.created_at ? new Date(r.created_at).toLocaleString() : r.id} — {r.overall_health_score ?? '—'}/100 ({r.grade || '—'}) {r.trigger_type ? `(${r.trigger_type})` : ''}
                </option>
            ))}
        </Form.Select>
    );
}
