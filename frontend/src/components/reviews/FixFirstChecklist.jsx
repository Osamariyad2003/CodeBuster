import React, { useState } from 'react';
import { FaShieldAlt, FaExclamationTriangle, FaInfoCircle, FaBolt, FaChevronRight } from 'react-icons/fa';

const SEV_CONFIG = {
    critical: { color: '#EF4444', bg: '#FEF2F2', icon: FaShieldAlt,           label: 'Critical' },
    major:    { color: '#F59E0B', bg: '#FFFBEB', icon: FaExclamationTriangle, label: 'Major'    },
    minor:    { color: '#687FF5', bg: '#EEF2FF', icon: FaInfoCircle,          label: 'Minor'    },
    info:     { color: '#FF570A', bg: '#FFF3ED', icon: FaBolt,                label: 'Info'     },
};

const detectSeverity = (item) => {
    const raw = (item.severity || item.priority || '').toLowerCase();
    if (raw.includes('crit')) return 'critical';
    if (raw.includes('maj'))  return 'major';
    if (raw.includes('min'))  return 'minor';
    return 'info';
};

export default function FixFirstChecklist({ items = [], onSelectItem }) {
    const [checked, setChecked] = useState({});

    if (!items?.length) return (
        <div className="d-flex flex-column align-items-center justify-content-center py-4 text-center" style={{ minHeight: 120 }}>
            <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 600, color: '#94A3B8', fontSize: '0.85rem' }}>No action items</div>
            <div style={{ fontSize: '0.75rem', color: '#CBD5E1', marginTop: 4 }}>Run a scan to get prioritized fixes</div>
        </div>
    );

    const toggle = (id) => setChecked(p => ({ ...p, [id]: !p[id] }));
    const doneCount = Object.values(checked).filter(Boolean).length;

    return (
        <div>
            {/* progress bar */}
            <div className="d-flex align-items-center gap-2 mb-3">
                <div style={{ flex: 1, height: 5, background: 'var(--surface-muted, rgba(255,255,255,0.08))', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                        height: '100%', borderRadius: 99,
                        background: 'linear-gradient(90deg, #FF570A, #25E2A8)',
                        width: `${(doneCount / items.length) * 100}%`,
                        transition: 'width 0.35s ease',
                    }} />
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {doneCount}/{items.length}
                </span>
            </div>

            {/* items */}
            <div className="d-flex flex-column gap-2">
                {items.map((item, idx) => {
                    const id   = item.id ?? idx;
                    const sev  = detectSeverity(item);
                    const cfg  = SEV_CONFIG[sev];
                    const done = !!checked[id];
                    const Icon = cfg.icon;

                    return (
                        <div
                            key={id}
                            onClick={() => onSelectItem ? onSelectItem(id) : toggle(id)}
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                background: done ? 'var(--surface-muted, rgba(255,255,255,0.03))' : 'var(--surface-card, #0E1118)',
                                border: `1px solid ${done ? 'var(--border-subtle, rgba(255,255,255,0.05))' : cfg.color + '33'}`,
                                borderRadius: 10, padding: '10px 12px',
                                cursor: 'pointer',
                                opacity: done ? 0.55 : 1,
                                transition: 'all 0.18s',
                            }}
                            onMouseEnter={e => {
                                if (!done) e.currentTarget.style.background = cfg.color + '15';
                                e.currentTarget.style.borderColor = cfg.color + '66';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = done ? 'var(--surface-muted, rgba(255,255,255,0.03))' : 'var(--surface-card, #0E1118)';
                                e.currentTarget.style.borderColor = done ? 'var(--border-subtle, rgba(255,255,255,0.05))' : cfg.color + '33';
                            }}
                        >
                            {/* rank / check badge */}
                            <div style={{
                                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                background: done ? 'var(--surface-card-elevated, #151923)' : cfg.color,
                                color: done ? 'var(--text-muted)' : '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: 800,
                                marginTop: 1,
                            }}>
                                {done ? '✓' : idx + 1}
                            </div>

                            {/* text */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '0.82rem', fontWeight: 600,
                                    color: done ? 'var(--text-muted)' : 'var(--text-primary, #F8FAFC)',
                                    textDecoration: done ? 'line-through' : 'none',
                                    lineHeight: 1.4,
                                    display: '-webkit-box', WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                }}>
                                    {item.title || item.description || `Action #${idx + 1}`}
                                </div>
                                {item.category && (
                                    <div style={{ fontSize: '0.68rem', color: cfg.color, fontWeight: 600, marginTop: 2 }}>
                                        <Icon size={9} style={{ marginRight: 3 }} />
                                        {item.category}
                                    </div>
                                )}
                            </div>

                            {onSelectItem && (
                                <FaChevronRight size={10} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
