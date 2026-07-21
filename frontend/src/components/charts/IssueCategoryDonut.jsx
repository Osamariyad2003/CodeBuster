import React, { useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import ChartCard from './ChartCard';

const CATEGORY_COLORS = {
    security: 'var(--color-danger, #dc3545)',
    secrets: '#991b1b',
    dependencies: '#ec4899',
    quality: 'var(--primary-brand, #3b82f6)',
    code_quality: 'var(--primary-brand, #3b82f6)',
    performance: 'var(--color-warning, #f59e0b)',
    reliability: '#0ea5e9',
    maintainability: 'var(--color-success, #22c55e)',
    architecture: '#8b5cf6',
    other: '#6b7280',
};

const FALLBACK_COLORS = ['#3b82f6', '#dc3545', '#f59e0b', '#22c55e', '#0ea5e9', '#8b5cf6', '#6b7280', '#ec4899'];

const getColor = (category, index) => {
    const key = (category || '').toLowerCase().replace(/\s+/g, '_');
    return CATEGORY_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
};

const renderCenterLabel = (data) => {
    const total = data.reduce((s, d) => s + (d.count || 0), 0);
    return (
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
            <tspan x="50%" dy="-8" fontSize="22" fontWeight="700" fill="var(--text-primary, #111)">
                {total}
            </tspan>
            <tspan x="50%" dy="20" fontSize="11" fill="var(--text-muted, #6b7280)">
                issues
            </tspan>
        </text>
    );
};

const IssueCategoryDonut = ({ data, loading }) => {
    const [activeIndex, setActiveIndex] = useState(null);
    const chartData = (data || []).filter((d) => d.count > 0);

    return (
        <ChartCard
            title="Issue Distribution"
            tooltip="Issues grouped by category from the latest review."
            loading={loading}
            height={300}
        >
            {!chartData.length ? (
                <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 300 }}>
                    No issue data available
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={activeIndex !== null ? 110 : 105}
                            dataKey="count"
                            nameKey="category"
                            paddingAngle={2}
                            animationDuration={700}
                            onMouseEnter={(_, i) => setActiveIndex(i)}
                            onMouseLeave={() => setActiveIndex(null)}
                        >
                            {chartData.map((entry, i) => (
                                <Cell
                                    key={entry.category}
                                    fill={getColor(entry.category, i)}
                                    opacity={activeIndex !== null && activeIndex !== i ? 0.5 : 1}
                                    stroke="var(--surface-card, #fff)"
                                    strokeWidth={2}
                                />
                            ))}
                        </Pie>
                        {renderCenterLabel(chartData)}
                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: 'none',
                                background: 'var(--surface-card-elevated, #fff)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                color: 'var(--text-primary)',
                            }}
                            formatter={(value, name) => [`${value} issues`, name]}
                        />
                        <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: '11px', color: 'var(--text-muted)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
};

export default IssueCategoryDonut;
