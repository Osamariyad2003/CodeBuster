import React from 'react';
import { FaShieldAlt, FaCheckCircle, FaExclamationTriangle, FaBolt, FaHistory } from 'react-icons/fa';

const CARDS = [
    { key: 'health',          label: 'Health Score',  icon: FaShieldAlt,           fmt: v => v != null ? `${v}%` : '—', g: ['#10B981', '#059669'] },
    { key: 'total_issues',    label: 'Total Issues',  icon: FaCheckCircle,         fmt: v => v ?? '—',                  g: ['#6366F1', '#4F46E5'] },
    { key: 'critical_issues', label: 'Critical',      icon: FaExclamationTriangle, fmt: v => v ?? '—',                  g: ['#EF4444', '#DC2626'] },
    { key: 'events_count',    label: 'Recent Events', icon: FaBolt,                fmt: v => v ?? '—',                  g: ['#0EA5E9', '#0284C7'] },
    { key: 'active_jobs',     label: 'Active Jobs',   icon: FaHistory,             fmt: v => v ?? '—',                  g: ['#F59E0B', '#D97706'] },
];

export default function RepoStatsCards({ stats }) {
    return (
        <div className="d-flex flex-wrap gap-3 mb-4">
            {CARDS.map(({ key, label, icon: Icon, fmt, g: [c1, c2] }) => (
                <div
                    key={key}
                    style={{
                        flex: '1 1 130px', minWidth: 120,
                        background: '#fff',
                        border: '1px solid #F1F5F9',
                        borderRadius: 14,
                        padding: '16px 18px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'box-shadow 0.15s, transform 0.15s',
                        cursor: 'default',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'none'; }}
                >
                    <div style={{
                        position: 'absolute', top: -20, right: -20,
                        width: 80, height: 80, borderRadius: '50%',
                        background: `radial-gradient(circle, ${c1}18, transparent 70%)`,
                        pointerEvents: 'none',
                    }} />
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `linear-gradient(135deg, ${c1}, ${c2})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 4px 12px ${c1}45`,
                        marginBottom: 12,
                    }}>
                        <Icon size={15} color="#fff" />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                        {fmt(stats?.[key])}
                    </div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 5 }}>
                        {label}
                    </div>
                </div>
            ))}
        </div>
    );
}
