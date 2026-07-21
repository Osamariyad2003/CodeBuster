import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Badge, Spinner, Button, Alert } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from './lib/apiClient';
import Header from './Header';
import ConfidenceBadge from './components/ConfidenceBadge';
import { useToast } from './components/ToastProvider';
import { FaArrowLeft, FaTools, FaLightbulb, FaRobot, FaCheckCircle } from 'react-icons/fa';

const IssueDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [issue, setIssue] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fixing, setFixing] = useState(false);
    const [fixResult, setFixResult] = useState(null);

    useEffect(() => {
        const fetchIssue = async () => {
            try {
                const response = await apiClient.get(`/api/issues/${id}`);
                setIssue(response.data);
            } catch (err) {
                console.error('Failed to fetch issue details', err);
            } finally {
                setLoading(false);
            }
        };
        fetchIssue();
    }, [id]);

    const runBugFixAgent = async () => {
        setFixing(true);
        setFixResult(null);
        try {
            const res = await apiClient.post('/github/fix/apply', {
                issue_id: issue.id,
                review_id: issue.review_id
            });
            if (res.success) {
                showToast(`Fix committed on branch ${res.branch}`, 'success');
                setFixResult({ success: true, branch: res.branch, url: res.url });
                setIssue({ ...issue, status: 'resolved' });
            } else {
                showToast(res.error || 'Fix failed', 'danger');
                setFixResult({ success: false, error: res.error });
            }
        } catch (err) {
            const msg = err?.userMessage || 'Failed to run Bug Fix Agent';
            showToast(msg, 'danger');
            setFixResult({ success: false, error: msg });
        } finally {
            setFixing(false);
        }
    };

    if (loading) return <><Header /><Container className="d-flex justify-content-center py-5"><Spinner animation="border" /></Container></>;
    if (!issue) return <><Header /><Container className="py-5">Issue not found</Container></>;

    return (
        <>
            <Header />
            <Container className="py-5" style={{ maxWidth: 1000 }}>
                <Button variant="link" onClick={() => navigate('/issues')} className="mb-3 ps-0 text-decoration-none text-muted">
                    <FaArrowLeft className="me-2" /> Back to Issues
                </Button>

                <div className="d-flex justify-content-between align-items-start mb-4">
                    <div style={{ maxWidth: '70%' }}>
                        <h2 className="fw-bold mb-2">{issue.title || issue.message}</h2>
                        <p className="text-monospace bg-light p-2 rounded small d-inline-block border">
                            {issue.file_path}:{issue.line_number}
                        </p>
                    </div>
                    <div className="text-end">
                        <Badge bg={issue.severity === 'critical' ? 'danger' : 'warning'} className="mb-2 fs-6 d-block">{issue.severity}</Badge>
                        <ConfidenceBadge score={issue.confidence} />
                    </div>
                </div>

                {/* Bug Fix Agent */}
                <Card className="border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.05), rgba(6,182,212,0.05))' }}>
                    <Card.Body>
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                            <div className="d-flex align-items-center">
                                <div
                                    style={{
                                        width: 44, height: 44, borderRadius: 10,
                                        background: 'linear-gradient(135deg, #4F46E5, #06B6D4)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', marginRight: 12
                                    }}
                                >
                                    <FaRobot size={20} />
                                </div>
                                <div>
                                    <h6 className="fw-bold mb-0">Bug Fix Agent</h6>
                                    <div className="text-muted small">Generates a patch and commits it to a new branch on GitHub</div>
                                </div>
                            </div>
                            <Button
                                variant="primary"
                                onClick={runBugFixAgent}
                                disabled={fixing || issue.status === 'resolved'}
                            >
                                {issue.status === 'resolved' ? (
                                    <><FaCheckCircle className="me-2" />Fix Applied</>
                                ) : fixing ? (
                                    <><Spinner size="sm" animation="border" className="me-2" />Running Agent…</>
                                ) : (
                                    <><FaRobot className="me-2" />Run Bug Fix Agent</>
                                )}
                            </Button>
                        </div>
                        {fixResult?.success && (
                            <Alert variant="success" className="mt-3 mb-0">
                                Fix committed on branch <code>{fixResult.branch}</code>.{' '}
                                {fixResult.url && <a href={fixResult.url} target="_blank" rel="noreferrer">View commit on GitHub →</a>}
                            </Alert>
                        )}
                        {fixResult && !fixResult.success && (
                            <Alert variant="danger" className="mt-3 mb-0">{fixResult.error}</Alert>
                        )}
                    </Card.Body>
                </Card>

                {/* AI Explanation */}
                <Card className="border-0 shadow-sm mb-4">
                    <Card.Body>
                        <h5 className="fw-bold mb-3"><FaLightbulb className="text-warning me-2" />Analysis</h5>
                        <p>{issue.explanation || "No detailed explanation available."}</p>

                        {issue.suggested_fix && (
                            <div className="mt-4">
                                <h6 className="fw-bold text-success">Suggested Fix</h6>
                                <pre className="bg-dark text-white p-3 rounded">{issue.suggested_fix}</pre>
                            </div>
                        )}
                    </Card.Body>
                </Card>

                {/* Tool Evidence */}
                <Card className="border-0 shadow-sm mb-4">
                    <Card.Header className="bg-light fw-bold"><FaTools className="me-2 text-secondary" />Tool Evidence</Card.Header>
                    <Card.Body>
                        {issue.evidence ? (
                            <pre className="mb-0 small bg-light p-3 border rounded text-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                                {JSON.stringify(issue.evidence, null, 2)}
                            </pre>
                        ) : (
                            <p className="text-muted mb-0">No raw tool evidence available.</p>
                        )}
                        <div className="mt-3 text-muted small">
                            Detected by: <strong>{issue.tool || "Unknown Tool"}</strong>
                        </div>
                    </Card.Body>
                </Card>
            </Container>
        </>
    );
};

export default IssueDetail;
