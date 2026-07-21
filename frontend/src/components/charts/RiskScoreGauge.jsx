import React from 'react';
import ChartCard from './ChartCard';

const ARC_RADIUS = 80;
const ARC_WIDTH = 16;
const CX = 120;
const CY = 100;

const describeArc = (startAngle, endAngle) => {
    const r = ARC_RADIUS;
    const start = polarToCartesian(CX, CY, r, endAngle);
    const end = polarToCartesian(CX, CY, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

const polarToCartesian = (cx, cy, r, angleDeg) => {
    const rad = ((angleDeg - 180) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const getScoreColor = (score) => {
    if (score >= 70) return 'var(--color-success, #22c55e)';
    if (score >= 40) return 'var(--color-warning, #f59e0b)';
    return 'var(--color-danger, #dc3545)';
};

const getGrade = (score) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
};

const RiskScoreGauge = ({ score, criticalCount, loading }) => {
    const safeScore = Math.max(0, Math.min(100, score || 0));
    const needleAngle = (safeScore / 100) * 180;
    const needleEnd = polarToCartesian(CX, CY, ARC_RADIUS - 6, needleAngle);

    return (
        <ChartCard
            title="Risk Score"
            tooltip="Overall repository health gauge. Green (70-100), Yellow (40-70), Red (0-40)."
            loading={loading}
            height={200}
        >
            <div className="d-flex flex-column align-items-center">
                <svg width={240} height={130} viewBox="0 0 240 130">
                    {/* Background arc */}
                    <path
                        d={describeArc(0, 180)}
                        fill="none"
                        stroke="var(--border-subtle, #e9ecef)"
                        strokeWidth={ARC_WIDTH}
                        strokeLinecap="round"
                    />
                    {/* Red zone 0-40 */}
                    <path
                        d={describeArc(0, 72)}
                        fill="none"
                        stroke="var(--color-danger, #dc3545)"
                        strokeWidth={ARC_WIDTH}
                        strokeLinecap="round"
                        opacity={0.2}
                    />
                    {/* Yellow zone 40-70 */}
                    <path
                        d={describeArc(72, 126)}
                        fill="none"
                        stroke="var(--color-warning, #f59e0b)"
                        strokeWidth={ARC_WIDTH}
                        strokeLinecap="round"
                        opacity={0.2}
                    />
                    {/* Green zone 70-100 */}
                    <path
                        d={describeArc(126, 180)}
                        fill="none"
                        stroke="var(--color-success, #22c55e)"
                        strokeWidth={ARC_WIDTH}
                        strokeLinecap="round"
                        opacity={0.2}
                    />
                    {/* Active arc up to score */}
                    {safeScore > 0 && (
                        <path
                            d={describeArc(0, needleAngle)}
                            fill="none"
                            stroke={getScoreColor(safeScore)}
                            strokeWidth={ARC_WIDTH}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                        />
                    )}
                    {/* Needle */}
                    <line
                        x1={CX}
                        y1={CY}
                        x2={needleEnd.x}
                        y2={needleEnd.y}
                        stroke="var(--text-primary, #111)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        style={{ transition: 'all 1s ease-out' }}
                    />
                    <circle cx={CX} cy={CY} r={4} fill="var(--text-primary, #111)" />
                    {/* Score text */}
                    <text x={CX} y={CY - 18} textAnchor="middle" fontSize={28} fontWeight="700" fill="var(--text-primary, #111)">
                        {safeScore}
                    </text>
                    <text x={CX} y={CY - 2} textAnchor="middle" fontSize={11} fill="var(--text-muted, #6b7280)">
                        / 100
                    </text>
                    {/* Grade badge */}
                    <rect x={CX - 14} y={CY + 6} width={28} height={18} rx={4} fill={getScoreColor(safeScore)} opacity={0.15} />
                    <text x={CX} y={CY + 19} textAnchor="middle" fontSize={11} fontWeight="600" fill={getScoreColor(safeScore)}>
                        {getGrade(safeScore)}
                    </text>
                </svg>
                {criticalCount > 0 && (
                    <span
                        className="badge mt-1"
                        style={{
                            background: 'var(--color-danger, #dc3545)',
                            color: '#fff',
                            fontSize: '11px',
                            padding: '3px 8px',
                        }}
                    >
                        {criticalCount} critical issue{criticalCount !== 1 ? 's' : ''}
                    </span>
                )}
            </div>
        </ChartCard>
    );
};

export default RiskScoreGauge;
