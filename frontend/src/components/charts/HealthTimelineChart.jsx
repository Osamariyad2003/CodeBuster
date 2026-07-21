import React from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, ReferenceLine
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

const CustomDot = (props) => {
    const { cx, cy, index, payload, data } = props;
    if (index > 0 && data && data[index - 1]) {
        const prev = data[index - 1].overall_score ?? data[index - 1].score ?? 0;
        const curr = payload.overall_score ?? payload.score ?? 0;
        if (prev - curr > 10) {
            return <circle cx={cx} cy={cy} r={5} fill="var(--color-danger, #dc3545)" stroke="#fff" strokeWidth={2} />;
        }
    }
    return <circle cx={cx} cy={cy} r={3} fill="var(--primary-brand, #3b82f6)" stroke="none" />;
};

const HealthTimelineChart = ({ data, days = 30, onDaysChange, loading }) => {
    const chartData = (data || []).map((d) => ({
        ...d,
        date: d.date ? d.date.slice(0, 10) : 'N/A',
        score: d.overall_score ?? d.score ?? 0,
    }));

    return (
        <ChartCard
            title="Health Timeline"
            tooltip="Repository health score over time. Red dots indicate drops greater than 10 points."
            loading={loading}
            height={280}
            headerRight={onDaysChange && <DayToggle days={days} onDaysChange={onDaysChange} />}
        >
            {!chartData.length ? (
                <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 280 }}>
                    No trend data available
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData}>
                        <defs>
                            <linearGradient id="healthLineGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--primary-brand, #3b82f6)" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="var(--primary-brand, #3b82f6)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
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
                            width={35}
                        />
                        <ReferenceLine y={70} stroke="var(--color-warning, #f59e0b)" strokeDasharray="4 4" strokeOpacity={0.6} />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: 'none',
                                background: 'var(--surface-card-elevated, #fff)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                color: 'var(--text-primary)',
                            }}
                            formatter={(value) => [`${value}`, 'Score']}
                        />
                        <Line
                            type="monotone"
                            dataKey="score"
                            stroke="var(--primary-brand, #3b82f6)"
                            strokeWidth={2.5}
                            dot={(props) => <CustomDot {...props} data={chartData} />}
                            activeDot={{ r: 6, fill: 'var(--primary-brand, #3b82f6)', stroke: '#fff', strokeWidth: 2 }}
                            animationDuration={700}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
};

export default HealthTimelineChart;
