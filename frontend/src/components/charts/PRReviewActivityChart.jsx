import React from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend
} from 'recharts';
import ChartCard from './ChartCard';

const DayToggle = ({ days, onDaysChange }) => (
    <div className="btn-group btn-group-sm">
        {[7, 14, 30].map((d) => (
            <button
                key={d}
                type="button"
                className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '11px', padding: '2px 8px' }}
                onClick={() => onDaysChange(d)}
            >
                {d}d
            </button>
        ))}
    </div>
);

const PRReviewActivityChart = ({ data, days = 30, onDaysChange, loading }) => {
    return (
        <ChartCard
            title="Review Activity"
            tooltip="Reviews per day, split by approval status."
            loading={loading}
            height={280}
            headerRight={onDaysChange && <DayToggle days={days} onDaysChange={onDaysChange} />}
        >
            {!data?.length ? (
                <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 280 }}>
                    No review activity data
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data} barGap={2} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, #e9ecef)" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            dy={8}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            width={30}
                            allowDecimals={false}
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
                        <Bar dataKey="total" name="Total" fill="var(--primary-brand, #3b82f6)" radius={[3, 3, 0, 0]} animationDuration={600} />
                        <Bar dataKey="flagged" name="Flagged" fill="var(--color-danger, #dc3545)" radius={[3, 3, 0, 0]} animationDuration={600} />
                        <Bar dataKey="approved" name="Approved" fill="var(--color-success, #22c55e)" radius={[3, 3, 0, 0]} animationDuration={600} />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
};

export default PRReviewActivityChart;
