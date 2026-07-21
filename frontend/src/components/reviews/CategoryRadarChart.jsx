import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

const scoreColor = (s) => s >= 75 ? '#10B981' : s >= 60 ? '#F59E0B' : '#EF4444';

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { subject, score } = payload[0]?.payload || {};
    const color = scoreColor(score);
    return (
        <div style={{
            background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            padding: '8px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', marginBottom: 3 }}>{subject}</div>
            <div style={{ color, fontWeight: 800, fontSize: '1.2rem' }}>{score}<span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>/100</span></div>
        </div>
    );
};

const CustomTick = ({ x, y, payload }) => {
    const words = (payload.value || '').split(' ');
    return (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600} fill="#64748B">
            {words.map((w, i) => <tspan key={i} x={x} dy={i === 0 ? (words.length > 1 ? -6 : 0) : 13}>{w}</tspan>)}
        </text>
    );
};

export default function CategoryRadarChart({ categories = [], height = 280 }) {
    const data = categories.map(c => ({ subject: c.label || c.key, score: c.score ?? 0, fullMark: 100 }));

    if (!data.length) return (
        <div className="d-flex align-items-center justify-content-center text-muted" style={{ height }}>
            <div className="text-center">
                <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 8 }}>📊</div>
                <div style={{ fontWeight: 600, color: '#94A3B8', fontSize: '0.85rem' }}>No category scores yet</div>
            </div>
        </div>
    );

    const avg = Math.round(data.reduce((s, d) => s + d.score, 0) / data.length);

    return (
        <div>
            {/* avg badge */}
            <div className="d-flex justify-content-end mb-1">
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: scoreColor(avg), background: scoreColor(avg) + '15', padding: '2px 10px', borderRadius: 999 }}>
                    Avg {avg}/100
                </span>
            </div>
            <ResponsiveContainer width="100%" height={height}>
                <RadarChart cx="50%" cy="50%" outerRadius="68%" data={data}>
                    <defs>
                        <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366F1" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.15} />
                        </linearGradient>
                    </defs>
                    <PolarGrid stroke="rgba(148,163,184,0.2)" />
                    <PolarAngleAxis dataKey="subject" tick={<CustomTick />} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} tickCount={4} />
                    <Radar
                        name="Score"
                        dataKey="score"
                        stroke="#6366F1"
                        strokeWidth={2}
                        fill="url(#radarFill)"
                        dot={{ r: 3, fill: '#6366F1', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
