import React from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend
} from 'recharts';
import ChartCard from './ChartCard';

const CATEGORY_BARS = [
    { key: 'security', name: 'Security', color: 'var(--color-danger, #dc3545)' },
    { key: 'code_quality', name: 'Quality', color: 'var(--primary-brand, #3b82f6)' },
    { key: 'performance', name: 'Performance', color: 'var(--color-warning, #f59e0b)' },
    { key: 'reliability', name: 'Reliability', color: '#0ea5e9' },
    { key: 'architecture', name: 'Architecture', color: '#8b5cf6' },
];

const CodeQualityBreakdown = ({ data, loading }) => {
    return (
        <ChartCard
            title="Quality Breakdown"
            tooltip="Category scores across reviews. Each bar segment represents one quality dimension."
            loading={loading}
            height={280}
        >
            {!data?.length ? (
                <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 280 }}>
                    No quality breakdown data
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data} barCategoryGap="15%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, #e9ecef)" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            dy={8}
                        />
                        <YAxis
                            domain={[0, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            width={30}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: 'none',
                                background: 'var(--surface-card-elevated, #fff)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                color: 'var(--text-primary)',
                            }}
                        />
                        <Legend
                            verticalAlign="top"
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                        />
                        {CATEGORY_BARS.map((cat) => (
                            <Bar
                                key={cat.key}
                                dataKey={cat.key}
                                name={cat.name}
                                stackId="quality"
                                fill={cat.color}
                                animationDuration={600}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
};

export default CodeQualityBreakdown;
