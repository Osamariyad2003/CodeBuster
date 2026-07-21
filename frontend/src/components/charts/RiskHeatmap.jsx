import React, { useMemo } from 'react';
import { Tooltip as BsTooltip, OverlayTrigger } from 'react-bootstrap';
import ChartCard from './ChartCard';

const interpolateColor = (score, maxScore) => {
    if (!maxScore) return 'var(--border-subtle, #e9ecef)';
    const ratio = Math.min(score / maxScore, 1);
    // green → yellow → red
    if (ratio < 0.5) {
        const g = Math.round(180 + (255 - 180) * (1 - ratio * 2));
        const r = Math.round(34 + (245 - 34) * ratio * 2);
        return `rgb(${r}, ${g}, 80)`;
    }
    const r = Math.round(245 - (245 - 220) * (ratio - 0.5) * 2);
    const g = Math.round(180 * (1 - (ratio - 0.5) * 2));
    return `rgb(${r}, ${g}, 60)`;
};

const RiskHeatmap = ({ data, loading }) => {
    const { directories, categories, grid, maxScore } = useMemo(() => {
        if (!data?.length) return { directories: [], categories: [], grid: {}, maxScore: 0 };
        const dirs = [...new Set(data.map((d) => d.directory))];
        const cats = [...new Set(data.map((d) => d.category))];
        const g = {};
        let mx = 0;
        data.forEach((d) => {
            const key = `${d.directory}::${d.category}`;
            g[key] = d;
            if (d.severity_score > mx) mx = d.severity_score;
        });
        return { directories: dirs, categories: cats, grid: g, maxScore: mx };
    }, [data]);

    const cellSize = 44;
    const labelWidth = 120;
    const headerHeight = 80;

    return (
        <ChartCard
            title="Risk Heatmap"
            tooltip="Directory vs category risk grid. Darker cells indicate higher severity concentration."
            loading={loading}
            height={Math.max(280, headerHeight + categories.length * cellSize + 20)}
        >
            {!directories.length ? (
                <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 280 }}>
                    No risk data available
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <svg
                        width={Math.max(300, labelWidth + directories.length * cellSize + 10)}
                        height={headerHeight + categories.length * cellSize + 10}
                        style={{ display: 'block' }}
                    >
                        {/* Column headers (directories) */}
                        {directories.map((dir, i) => (
                            <text
                                key={dir}
                                x={labelWidth + i * cellSize + cellSize / 2}
                                y={headerHeight - 8}
                                textAnchor="end"
                                fontSize={10}
                                fill="var(--text-muted, #6b7280)"
                                transform={`rotate(-45, ${labelWidth + i * cellSize + cellSize / 2}, ${headerHeight - 8})`}
                            >
                                {dir.length > 12 ? dir.slice(0, 12) + '…' : dir}
                            </text>
                        ))}
                        {/* Row labels (categories) + cells */}
                        {categories.map((cat, ri) => (
                            <g key={cat}>
                                <text
                                    x={labelWidth - 8}
                                    y={headerHeight + ri * cellSize + cellSize / 2 + 4}
                                    textAnchor="end"
                                    fontSize={11}
                                    fill="var(--text-secondary, #9ca3af)"
                                >
                                    {cat.length > 14 ? cat.slice(0, 14) + '…' : cat}
                                </text>
                                {directories.map((dir, ci) => {
                                    const cell = grid[`${dir}::${cat}`];
                                    const score = cell?.severity_score || 0;
                                    const count = cell?.issue_count || 0;
                                    return (
                                        <OverlayTrigger
                                            key={`${dir}-${cat}`}
                                            placement="top"
                                            overlay={
                                                <BsTooltip>
                                                    {dir} / {cat}<br />
                                                    Issues: {count}, Severity: {score}
                                                </BsTooltip>
                                            }
                                        >
                                            <rect
                                                x={labelWidth + ci * cellSize + 2}
                                                y={headerHeight + ri * cellSize + 2}
                                                width={cellSize - 4}
                                                height={cellSize - 4}
                                                rx={4}
                                                fill={score ? interpolateColor(score, maxScore) : 'var(--border-subtle, #e9ecef)'}
                                                opacity={score ? 0.85 : 0.3}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </OverlayTrigger>
                                    );
                                })}
                            </g>
                        ))}
                    </svg>
                </div>
            )}
        </ChartCard>
    );
};

export default RiskHeatmap;
