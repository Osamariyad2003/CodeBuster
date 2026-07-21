import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Badge, Spinner, Button, Table } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { getReview, getReviewCanonical } from './lib/apiClient';
import { FaArrowLeft, FaExternalLinkAlt, FaChartLine, FaListUl } from 'react-icons/fa';
import CategoryRadarChart from './components/reviews/CategoryRadarChart';
import AnalyzerStatusList from './components/reviews/AnalyzerStatusList';
import IssueDetailDrawer from './components/reviews/IssueDetailDrawer';

const gradeVariant = (grade) => {
    if (!grade) return 'secondary';
    switch (grade.toUpperCase()) {
        case 'A': return 'success';
        case 'B': return 'primary';
        case 'C': return 'warning';
        case 'D': return 'orange';
        case 'F': return 'danger';
        default: return 'secondary';
    }
};

const statusVariant = (state) => {
    const s = (state || '').toLowerCase();
    if (s === 'completed') return 'success';
    if (s === 'running') return 'primary';
    if (s === 'pending') return 'secondary';
    if (s === 'failed') return 'danger';
    return 'secondary';
};

const severityBadge = (sev) => {
    const v = (sev || '').toLowerCase();
    const bg = v === 'critical' ? 'danger' : v === 'major' ? 'warning' : v === 'minor' ? 'info' : 'secondary';
    return <Badge bg={bg}>{sev || '—'}</Badge>;
};

export default function ReviewDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [canonical, setCanonical] = useState(null);
    const [legacy, setLegacy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedFinding, setSelectedFinding] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const canon = await getReviewCanonical(id);
                setCanonical(canon);
            } catch (_) {
                try {
                    const data = await getReview(id);
                    setLegacy(data);
                } catch (e) {
                    console.error('Failed to fetch review', e);
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
                <Spinner animation="border" />
            </Container>
        );
    }

    const hasData = canonical || legacy;
    if (!hasData) {
        return (
            <Container className="py-5">
                <Button variant="link" onClick={() => navigate(-1)} className="mb-3 ps-0 text-decoration-none text-muted">
                    <FaArrowLeft className="me-2" /> Back
                </Button>
                <div className="text-center">Review not found</div>
            </Container>
        );
    }

    const repo = canonical?.repo;
    const commit = canonical?.commit;
    const status = canonical?.status;
    const scores = canonical?.scores;
    const summary = canonical?.summary;
    const analyzers = canonical?.analyzers;
    const findings = canonical?.findings ?? legacy?.issues ?? [];

    const categories = scores?.by_category?.length
        ? scores.by_category.map((c) => ({ key: c.key, label: c.key.replace(/_/g, ' '), score: c.score }))
        : (legacy?.category_scores && Object.entries(legacy.category_scores).map(([k, v]) => ({ key: k, label: k.replace(/_/g, ' '), score: v }))) || [];

    const overallScore = scores?.overall?.value ?? legacy?.overall_health_score ?? 0;
    const overallGrade = scores?.overall?.grade ?? (overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : overallScore >= 60 ? 'D' : 'F');

    return (
        <Container className="py-4" style={{ maxWidth: 1200 }}>
            <Button variant="link" onClick={() => navigate(-1)} className="mb-3 ps-0 text-decoration-none text-muted">
                <FaArrowLeft className="me-2" /> Back
            </Button>

            {/* Header: repo, commit, branch, status */}
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                <div>
                    <h1 className="fw-bold mb-2">
                        {repo?.full_name || legacy?.repo_name || 'Review'}
                    </h1>
                    <p className="text-muted mb-1">
                        {repo?.url ? (
                            <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                                {repo.full_name} <FaExternalLinkAlt className="small" />
                            </a>
                        ) : (
                            repo?.full_name || legacy?.repo_name
                        )}
                    </p>
                    <p className="text-muted small mb-0">
                        {commit?.sha && <code className="me-2">{commit.sha.slice(0, 7)}</code>}
                        {commit?.branch && <span>Branch: {commit.branch}</span>}
                        {status?.duration_ms != null && (
                            <span className="ms-2">Duration: {(status.duration_ms / 1000).toFixed(1)}s</span>
                        )}
                    </p>
                </div>
                <Badge bg={statusVariant(status?.state ?? legacy?.status)} style={{ fontSize: '1rem', padding: '8px 16px' }}>
                    {status?.state ?? legacy?.status ?? '—'}
                </Badge>
            </div>

            {/* Score overview */}
            <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-white py-3 fw-bold d-flex align-items-center gap-2">
                    <FaChartLine /> Score overview
                </Card.Header>
                <Card.Body>
                    <div className="d-flex align-items-center gap-4 flex-wrap mb-3">
                        <div className="d-flex align-items-baseline gap-2">
                            <span className="display-5 fw-bold">{overallScore}</span>
                            <span className="text-muted">/ 100</span>
                        </div>
                        <Badge bg={gradeVariant(overallGrade)} className="px-3 py-2" style={{ fontSize: '1.1rem' }}>
                            Grade {overallGrade}
                        </Badge>
                        {scores?.overall?.trend && (
                            <span className={`small ${scores.overall.trend === 'up' ? 'text-success' : scores.overall.trend === 'down' ? 'text-danger' : 'text-muted'}`}>
                                {scores.overall.trend === 'up' ? '↑' : scores.overall.trend === 'down' ? '↓' : '→'} trend
                            </span>
                        )}
                    </div>
                    {summary?.severity_counts && Object.keys(summary.severity_counts).length > 0 && (
                        <div className="d-flex gap-3 flex-wrap small text-muted mb-3">
                            {Object.entries(summary.severity_counts).map(([k, v]) => (
                                <span key={k}>{k}: <strong>{v}</strong></span>
                            ))}
                        </div>
                    )}
                    {categories.length > 0 && (
                        <div style={{ height: 220 }}>
                            <CategoryRadarChart categories={categories} height={220} />
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Analyzers */}
            {(analyzers?.length > 0 || legacy?.extra_metadata?.analyzers_run?.length > 0) && (
                <Card className="border-0 shadow-sm mb-4">
                    <Card.Header className="bg-white py-3 fw-bold">Analyzers</Card.Header>
                    <Card.Body>
                        <AnalyzerStatusList analyzers={analyzers || legacy?.extra_metadata} />
                    </Card.Body>
                </Card>
            )}

            {/* Findings */}
            <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-white py-3 fw-bold d-flex align-items-center gap-2">
                    <FaListUl /> Findings
                </Card.Header>
                <Card.Body>
                    {findings.length === 0 ? (
                        <p className="text-muted mb-0">No findings. This scan is clean.</p>
                    ) : (
                        <Table hover responsive size="sm">
                            <thead className="table-light">
                                <tr>
                                    <th>Severity</th>
                                    <th>Title</th>
                                    <th>Dimension</th>
                                    <th>File</th>
                                    <th>Confidence</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {findings.map((f) => {
                                    const file = f.locations?.[0]?.file_path ?? f.file_path ?? f.file;
                                    const conf = f.confidence != null ? `${Math.round(f.confidence * 100)}%` : '—';
                                    return (
                                        <tr
                                            key={f.finding_id ?? f.id}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => { setSelectedFinding(f); setDrawerOpen(true); }}
                                        >
                                            <td>{severityBadge(f.severity)}</td>
                                            <td className="text-truncate" style={{ maxWidth: 280 }}>{f.title || 'Finding'}</td>
                                            <td><Badge bg="light" text="dark">{f.dimension || f.category || '—'}</Badge></td>
                                            <td className="text-truncate small" style={{ maxWidth: 180 }}>{file || '—'}</td>
                                            <td>{conf}</td>
                                            <td><Button variant="link" size="sm" className="p-0">Details</Button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
            </Card>

            {/* Next actions / Top risks */}
            {((summary?.next_actions?.length > 0) || (summary?.top_risks?.length > 0)) && (
                <Card className="border-0 shadow-sm mb-4 bg-light">
                    <Card.Header className="py-3 fw-bold">Next actions</Card.Header>
                    <Card.Body>
                        <ul className="mb-0">
                            {(summary.next_actions || []).slice(0, 5).map((a, i) => (
                                <li key={i} className="mb-1">{a}</li>
                            ))}
                            {(summary.top_risks || []).slice(0, 5).map((r, i) => (
                                <li key={`r-${i}`} className="mb-1 text-danger">{r}</li>
                            ))}
                        </ul>
                    </Card.Body>
                </Card>
            )}

            <IssueDetailDrawer
                show={drawerOpen}
                onHide={() => setDrawerOpen(false)}
                issue={selectedFinding}
                canonicalFinding={!!canonical}
            />
        </Container>
    );
}
