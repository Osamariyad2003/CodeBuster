import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Alert, Form } from 'react-bootstrap';
import { FaCommentDots, FaThumbsDown, FaExclamationTriangle } from 'react-icons/fa';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    LineChart, Line, Legend,
} from 'recharts';
import ChartCard from '../components/charts/ChartCard';
import Skeleton from '../components/Skeleton';
import { getFeedbackStats } from '../lib/apiClient';

const DAYS_OPTIONS = [7, 30, 90];

const pct = (n) => `${Math.round((n || 0) * 100)}%`;

const StatCard = ({ icon: Icon, label, value, sub, loading }) => (
    <Card className="h-100 shadow-sm" style={{ border: '1px solid var(--border-subtle, #e9ecef)', borderRadius: '12px' }}>
        <Card.Body style={{ padding: '16px' }}>
            {loading ? (
                <Skeleton height="64px" />
            ) : (
                <div className="d-flex align-items-center gap-3">
                    <div
                        className="d-flex align-items-center justify-content-center"
                        style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-muted, #f3f4f6)', flexShrink: 0 }}
                    >
                        <Icon size={18} color="var(--primary-brand, #3b82f6)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div className="text-muted" style={{ fontSize: '0.78rem' }}>{label}</div>
                        <div className="fw-bold" style={{ fontSize: '1.4rem', lineHeight: 1.2 }}>{value}</div>
                        {sub && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{sub}</div>}
                    </div>
                </div>
            )}
        </Card.Body>
    </Card>
);

const FeedbackInsightsPage = () => {
    const [days, setDays] = useState(30);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getFeedbackStats({ days })
            .then((res) => {
                if (!cancelled) setStats(res);
            })
            .catch((e) => {
                if (!cancelled) setError(e?.message || 'Failed to load feedback stats');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [days]);

    const byModule = stats?.by_module || [];
    const trend = stats?.trend || [];
    const disputedCategories = stats?.top_disputed_categories || [];

    return (
        <Container fluid style={{ padding: '24px' }}>
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                <div>
                    <h4 className="fw-bold mb-1">Finding Quality</h4>
                    <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                        How often reviewers dismiss AI findings — a proxy for false-positive rate and analyzer trust.
                    </p>
                </div>
                <Form.Select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    style={{ width: 160 }}
                    size="sm"
                >
                    {DAYS_OPTIONS.map((d) => (
                        <option key={d} value={d}>Last {d} days</option>
                    ))}
                </Form.Select>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            <Row className="g-3 mb-3">
                <Col md={4}>
                    <StatCard
                        icon={FaCommentDots}
                        label="Total feedback"
                        value={stats?.total_feedback ?? '—'}
                        sub={`in the last ${days} days`}
                        loading={loading}
                    />
                </Col>
                <Col md={4}>
                    <StatCard
                        icon={FaThumbsDown}
                        label="Overall dismiss rate"
                        value={stats ? pct(stats.overall_dismiss_rate) : '—'}
                        sub="share of findings dismissed or ignored"
                        loading={loading}
                    />
                </Col>
                <Col md={4}>
                    <StatCard
                        icon={FaExclamationTriangle}
                        label="Most disputed category"
                        value={stats?.top_disputed_category || 'None'}
                        sub="highest dismiss rate"
                        loading={loading}
                    />
                </Col>
            </Row>

            <Row className="g-3 mb-3">
                <Col md={6}>
                    <ChartCard
                        title="Dismiss rate by analyzer"
                        tooltip="Share of findings dismissed or ignored, grouped by analyzer module."
                        loading={loading}
                        height={280}
                    >
                        {byModule.length === 0 ? (
                            <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 280 }}>
                                No feedback data available
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={byModule} layout="vertical" margin={{ left: 24 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" domain={[0, 1]} tickFormatter={pct} fontSize={11} />
                                    <YAxis type="category" dataKey="key" width={100} fontSize={11} />
                                    <Tooltip formatter={(v, name, props) => [pct(v), `dismiss rate (${props.payload.total} total)`]} />
                                    <Bar dataKey="dismiss_rate" fill="var(--color-danger, #dc3545)" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                </Col>
                <Col md={6}>
                    <ChartCard
                        title="Dismiss rate over time"
                        tooltip="Daily share of findings dismissed or ignored."
                        loading={loading}
                        height={280}
                    >
                        {trend.length === 0 ? (
                            <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 280 }}>
                                No feedback data available
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={trend}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="key" fontSize={11} />
                                    <YAxis domain={[0, 1]} tickFormatter={pct} fontSize={11} />
                                    <Tooltip formatter={(v) => pct(v)} />
                                    <Legend />
                                    <Line type="monotone" dataKey="dismiss_rate" name="Dismiss rate" stroke="var(--primary-brand, #3b82f6)" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                </Col>
            </Row>

            <Card className="shadow-sm" style={{ border: '1px solid var(--border-subtle, #e9ecef)', borderRadius: '12px' }}>
                <Card.Header className="bg-transparent border-bottom fw-bold" style={{ padding: '12px 16px', fontSize: '0.95rem' }}>
                    Most disputed categories
                </Card.Header>
                <Card.Body style={{ padding: 0 }}>
                    {loading ? (
                        <div style={{ padding: 16 }}><Skeleton height="160px" /></div>
                    ) : disputedCategories.length === 0 ? (
                        <div className="text-muted text-center" style={{ padding: 32 }}>No feedback data available</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table mb-0" style={{ fontSize: '0.85rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '10px 16px' }}>Category</th>
                                        <th>Total feedback</th>
                                        <th>Dismissed</th>
                                        <th>Dismiss rate</th>
                                        <th>Sample comment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {disputedCategories.map((c) => (
                                        <tr key={c.category}>
                                            <td style={{ padding: '10px 16px', fontWeight: 600 }}>{c.category}</td>
                                            <td>{c.total}</td>
                                            <td>{c.dismissed}</td>
                                            <td>{pct(c.dismiss_rate)}</td>
                                            <td className="text-muted">{c.sample_comments?.[0] || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
};

export default FeedbackInsightsPage;
