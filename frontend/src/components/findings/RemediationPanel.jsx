import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { FaCheck, FaTimes, FaWrench } from 'react-icons/fa';
import confetti from 'canvas-confetti';

const RemediationPanel = ({ finding, onApplyFix }) => {
    const [applying, setApplying] = useState(false);

    const handleApply = async (e) => {
        setApplying(true);
        await onApplyFix();
        setApplying(false);

        if (finding?.severity?.toLowerCase() === 'critical') {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (rect.left + rect.right) / 2 / window.innerWidth;
            const y = (rect.top + rect.bottom) / 2 / window.innerHeight;
            
            confetti({
                particleCount: 80,
                spread: 60,
                origin: { x, y },
                colors: ['#CF222E', '#ffffff', '#8A2BE2'],
                disableForReducedMotion: true
            });
        }
    };

    const codeStyle = {
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        padding: '1rem',
        borderRadius: '4px',
        backgroundColor: '#f8f9fa'
    };

    return (
        <div className="border rounded-3 overflow-hidden shadow-sm mt-3">
            <div className="bg-light px-3 py-2 border-bottom d-flex align-items-center justify-content-between">
                <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                    <FaWrench size={14} className="text-primary" /> Suggested Fix
                </h6>
                <div className="d-flex gap-2">
                    <Button variant="outline-danger" size="sm" className="py-0 px-2" style={{ fontSize: '0.75rem' }}>Dismiss</Button>
                </div>
            </div>

            <div className="p-3">
                <div className="row g-0 border rounded mb-3">
                    <div className="col-12 border-bottom p-2 bg-danger-subtle text-danger small">
                        <span className="fw-bold">-</span> {finding.code_snippet || 'Original Code'}
                    </div>
                    <div className="col-12 p-2 bg-success-subtle text-success small">
                        <span className="fw-bold">+</span> {finding.suggested_fix?.content || 'Fixed Code'}
                    </div>
                </div>

                <Button
                    variant="primary"
                    size="sm"
                    className="w-100 fw-bold d-flex align-items-center justify-content-center gap-2"
                    onClick={handleApply}
                    disabled={applying}
                >
                    {applying ? <Spinner size="sm" /> : <FaCheck />}
                    {applying ? 'Applying Patch...' : 'Apply Fix & Commit'}
                </Button>
            </div>
        </div>
    );
};

export default RemediationPanel;
