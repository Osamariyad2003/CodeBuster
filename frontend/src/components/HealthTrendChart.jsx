import React, { useMemo } from 'react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { FaArrowUp, FaArrowDown, FaMinus } from 'react-icons/fa';

/* ── helpers ──────────────────────────────────────────────── */
const scoreGrade  = (s) => s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'F';
const scoreColor  = (s) => s >= 75 ? '#10B981' : s >= 60 ? '#F59E0B' : '#EF4444';
const gradeColor  = (g) => ({ A: '#10B981', B: '#3B82F6', C: '#F59E0B', D: '#F97316', F: '#EF4444' }[g] || '#6B7280');

const fmt = (v) => {
    if (!v) return '';
    if (/^[A-Za-z]{3}$/.test(String(v))) return v;
    const d = new Date(v);
    return isNaN(d) ? String(v) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const fmtFull = (v) => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d) ? String(v) : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

/* ── custom tooltip ───────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const val   = payload[0]?.value;
    const grade = val != null ? scoreGrade(val) : '–';
    const color = val != null ? gradeColor(grade) : '#6B7280';
    return (
        <div style={{
            background: 'rgba(15,23,42,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '10px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            minWidth: 140,
        }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', marginBottom: 6 }}>{fmtFull(label)}</div>
            <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F8FAFC', lineHeight: 1 }}>
                    {val ?? '–'}
                </span>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>score</div>
                    <div style={{ fontWeight: 700, color, fontSize: '0.9rem', lineHeight: 1.4 }}>Grade {grade}</div>
                </div>
            </div>
        </div>
    );
};

/* ── stat chip ────────────────────────────────────────────── */
const StatChip = ({ label, value, color, sub }) => (
    <div style={{ textAlign: 'center', minWidth: 56 }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: color || '#1E293B', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: '0.65rem', color, fontWeight: 700, lineHeight: 1.3 }}>{sub}</div>}
        <div style={{ fontSize: '0.65rem', color: '#94A3B8', lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
);

/* ── main component ───────────────────────────────────────── */
const HealthTrendChart = ({ data }) => {
    const clean = useMemo(() =>
        (data || []).filter(d => d.score != null || d.overall_score != null)
                   .map(d => ({ ...d, score: d.score ?? d.overall_score })),
    [data]);

    const latest  = clean.at(-1)?.score;
    const first   = clean.at(0)?.score;
    const avg     = clean.length ? Math.round(clean.reduce((s, d) => s + d.score, 0) / clean.length) : null;
    const min     = clean.length ? Math.min(...clean.map(d => d.score)) : null;
    const max     = clean.length ? Math.max(...clean.map(d => d.score)) : null;
    const delta   = latest != null && first != null ? latest - first : null;
    const grade   = latest != null ? scoreGrade(latest) : null;
    const color   = latest != null ? scoreColor(latest) : '#6366F1';

    if (!clean.length) return (
        <div className="d-flex flex-column align-items-center justify-content-center text-muted py-4 gap-2" style={{ minHeight: 220 }}>
            <div style={{ fontSize: 32, opacity: 0.2 }}>📈</div>
            <div style={{ fontWeight: 600, color: '#94A3B8' }}>No trend data yet</div>
            <div style={{ fontSize: '0.8rem', color: '#CBD5E1' }}>Run a scan to start tracking health score over time</div>
        </div>
    );

    const gradId = `hg-${color.replace('#', '')}`;

    return (
        <div>
            {/* ── stat row ── */}
            <div className="d-flex align-items-center gap-4 mb-3 px-1 flex-wrap">
                {latest != null && (
                    <StatChip
                        label="Current"
                        value={latest}
                        color={scoreColor(latest)}
                        sub={`Grade ${grade}`}
                    />
                )}
                {avg != null && <StatChip label="Avg" value={avg} color="#64748B" />}
                {min != null && <StatChip label="Min"  value={min}  color="#EF4444" />}
                {max != null && <StatChip label="Max"  value={max}  color="#10B981" />}
                {delta != null && (
                    <div style={{ textAlign: 'center', minWidth: 56 }}>
                        <div style={{
                            fontSize: '1.25rem', fontWeight: 800, lineHeight: 1,
                            color: delta > 0 ? '#10B981' : delta < 0 ? '#EF4444' : '#94A3B8',
                            display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center',
                        }}>
                            {delta > 0 ? <FaArrowUp size={14} /> : delta < 0 ? <FaArrowDown size={14} /> : <FaMinus size={14} />}
                            {Math.abs(delta)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                            30d change
                        </div>
                    </div>
                )}

                {/* grade bands legend */}
                <div className="ms-auto d-none d-sm-flex align-items-center gap-3" style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 20, height: 1.5, background: '#10B981', display: 'inline-block', borderRadius: 1 }} />
                        A ≥75
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 20, height: 1.5, background: '#F59E0B', display: 'inline-block', borderRadius: 1, borderStyle: 'dashed' }} />
                        C ≥60
                    </span>
                </div>
            </div>

            {/* ── chart ── */}
            <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                    <AreaChart data={clean} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
                                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />

                        {/* grade threshold lines */}
                        <ReferenceLine y={75} stroke="#10B981" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />
                        <ReferenceLine y={60} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />

                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#94A3B8' }}
                            tickFormatter={fmt}
                            minTickGap={20}
                            dy={8}
                        />
                        <YAxis
                            domain={[0, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#94A3B8' }}
                            width={32}
                            ticks={[0, 25, 50, 75, 100]}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 2', strokeOpacity: 0.5 }} />

                        <Area
                            type="monotone"
                            dataKey="score"
                            stroke={color}
                            strokeWidth={2.5}
                            fill={`url(#${gradId})`}
                            fillOpacity={1}
                            connectNulls
                            dot={false}
                            activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2, filter: 'drop-shadow(0 0 6px ' + color + '88)' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default HealthTrendChart;
