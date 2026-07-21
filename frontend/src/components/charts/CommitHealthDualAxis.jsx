import React from 'react';
import {
    ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend
} from 'recharts';
import ChartCard from './ChartCard';

const CommitHealthDualAxis = ({ data, loading }) => {
    return (
        <ChartCard
            title="Commit Activity vs Health"
            tooltip="Commit volume (bars) overlaid with health score trend (line). Helps spot if more commits correlate with lower quality."
            loading={loading}
            height={280}
        >
            {!data?.length ? (
                <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 280 }}>
                    No commit/health data
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, #e9ecef)" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            dy={8}
                        />
                        <YAxis
                            yAxisId="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            width={30}
                            allowDecimals={false}
                            label={{ value: 'Commits', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'var(--text-muted)' } }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={[0, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            width={30}
                            label={{ value: 'Score', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: 'var(--text-muted)' } }}
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
                        <Bar
                            yAxisId="left"
                            dataKey="commits"
                            name="Commits"
                            fill="var(--primary-brand, #3b82f6)"
                            fillOpacity={0.45}
                            radius={[3, 3, 0, 0]}
                            animationDuration={600}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="score"
                            name="Health Score"
                            stroke="var(--color-success, #22c55e)"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                            animationDuration={700}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
};

export default CommitHealthDualAxis;
