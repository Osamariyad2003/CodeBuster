import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Badge, Spinner, Button, Alert } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from './lib/apiClient';
import ConfidenceBadge from './components/ConfidenceBadge';
import CodeSnippetBlock from './components/CodeSnippetBlock';
import { useToast } from './components/ToastProvider';
import { FaArrowLeft, FaTools, FaLightbulb, FaRobot, FaCheckCircle, FaCode } from 'react-icons/fa';

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
                const toastMsg = res.pr_url
                    ? `Pull Request #${res.pr_number || ''} opened on branch ${res.branch}`
                    : `Fix committed on branch ${res.branch}`;
                showToast(toastMsg, 'success');
                setFixResult({
                    success: true,
                    branch: res.branch,
                    url: res.url,
                    pr_url: res.pr_url,
                    pr_number: res.pr_number,
                    ai_summary: res.ai_summary,
                });
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

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center py-5" style={{ minHeight: '60vh' }}>
                <Spinner animation="border" />
                <span className="ms-3 text-muted">Loading finding details…</span>
            </Container>
        );
    }

    if (!issue) {
        return (
            <Container className="py-5">
                <Alert variant="warning" style={{ borderRadius: 12 }}>Issue not found</Alert>
                <Button variant="outline-primary" onClick={() => navigate('/issues')} style={{ borderRadius: 8 }}>
                    Back to Issues & Patches
                </Button>
            </Container>
        );
    }

    return (
        <Container className="py-4" style={{ maxWidth: 1000 }}>
            <Button
                variant="link"
                onClick={() => navigate('/issues')}
                className="mb-3 ps-0 text-decoration-none text-muted d-inline-flex align-items-center"
                style={{ fontSize: '0.85rem' }}
            >
                <FaArrowLeft className="me-2" size={12} /> Back to Issues & Patches
            </Button>

            <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
                <div style={{ maxWidth: '75%' }}>
                    <h2 className="fw-bold mb-2" style={{ color: 'var(--text-primary)', fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                        {issue.title || issue.message}
                    </h2>
                    {(issue.file_path || issue.file) && (
                        <p
                            className="small d-inline-block px-2.5 py-1 rounded"
                            style={{
                                background: 'var(--surface-card-elevated)',
                                border: '1px solid var(--border-default)',
                                color: 'var(--text-secondary)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.8rem',
                            }}
                        >
                            {issue.file_path || issue.file}
                            {(issue.line_number || issue.line) ? `:${issue.line_number || issue.line}` : ''}
                        </p>
                    )}
                </div>
                <div className="text-end">
                    <Badge bg={issue.severity === 'critical' ? 'danger' : 'warning'} className="mb-2 fs-6 d-block" style={{ borderRadius: 8 }}>
                        {issue.severity}
                    </Badge>
                    <ConfidenceBadge score={issue.confidence} />
                </div>
            </div>

            {/* Bug Fix Agent Card */}
            <div
                className="mb-4 p-4 position-relative overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: 16,
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div className="d-flex align-items-center">
                        <div
                            style={{
                                width: 46,
                                height: 46,
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #FF570A, #25E2A8)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                marginRight: 14,
                                boxShadow: '0 6px 18px rgba(99, 102, 241, 0.3)',
                                flexShrink: 0,
                            }}
                        >
                            <FaRobot size={22} />
                        </div>
                        <div>
                            <h6 className="fw-bold mb-0" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
                                Autonomous Fix Agent
                            </h6>
                            <div className="text-muted small">Generates a patch and commits it directly to a new branch on GitHub</div>
                        </div>
                    </div>
                    <Button
                        variant="primary"
                        onClick={runBugFixAgent}
                        disabled={fixing || issue.status === 'resolved'}
                        style={{ borderRadius: 9, fontWeight: 600, padding: '8px 18px' }}
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
                    <Alert variant="success" className="mt-3 mb-0" style={{ borderRadius: 10 }}>
                        <div className="fw-bold mb-1">
                            {fixResult.pr_url ? `Pull Request #${fixResult.pr_number || ''} opened successfully!` : 'Fix committed successfully!'}
                        </div>
                        <div className="small text-muted mb-2">Branch: <code>{fixResult.branch}</code></div>
                        {fixResult.ai_summary && (
                            <div className="small mb-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}>
                                {fixResult.ai_summary}
                            </div>
                        )}
                        {fixResult.pr_url ? (
                            <a href={fixResult.pr_url} target="_blank" rel="noreferrer" className="fw-bold">
                                View Pull Request on GitHub →
                            </a>
                        ) : fixResult.url ? (
                            <a href={fixResult.url} target="_blank" rel="noreferrer" className="fw-bold">
                                View commit on GitHub →
                            </a>
                        ) : null}
                    </Alert>
                )}
                {fixResult && !fixResult.success && (
                    <Alert variant="danger" className="mt-3 mb-0" style={{ borderRadius: 10 }}>{fixResult.error}</Alert>
                )}
            </div>

            {/* Code Context from repository */}
            {issue.code_snippet && (
                <div className="mb-4">
                    <h5 className="fw-bold mb-3 d-flex align-items-center" style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                        <FaCode className="text-primary me-2" size={15} /> Code Context
                    </h5>
                    <CodeSnippetBlock
                        code={issue.code_snippet}
                        filePath={issue.file_path}
                        line={issue.line_number}
                        badge="CONTEXT"
                        badgeVariant="secondary"
                    />
                </div>
            )}

            {/* AI Explanation & Fix */}
            <div
                className="mb-4 p-4"
                style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 16,
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                <h5 className="fw-bold mb-3 d-flex align-items-center" style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                    <FaLightbulb className="text-warning me-2" size={16} /> Analysis & Reasoning
                </h5>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{issue.explanation || issue.ai_explanation || "No detailed explanation available."}</p>

                {(() => {
                    const fix = issue.suggested_fix;
                    if (!fix) return null;
                    const code = typeof fix === 'object' && fix !== null
                        ? (fix.patch || fix.code || fix.content || '')
                        : (typeof fix === 'string' ? fix : '');
                    if (!code.trim()) return null;

                    const isSteps = typeof fix === 'object' && fix !== null && fix.type === 'steps';

                    return (
                        <div className="mt-4">
                            <h6 className="fw-bold text-success mb-2" style={{ fontSize: '0.9rem' }}>Suggested Fix</h6>
                            {isSteps ? (
                                <Alert
                                    variant="info"
                                    className="mb-0"
                                    style={{
                                        borderRadius: 10,
                                        background: 'var(--surface-card-elevated)',
                                        borderColor: 'var(--border-default)',
                                        color: 'var(--text-primary)',
                                        lineHeight: 1.6,
                                    }}
                                >
                                    {code}
                                </Alert>
                            ) : (
                                <CodeSnippetBlock
                                    code={code}
                                    language={code.startsWith('diff') || code.includes('@@') ? 'diff' : 'python'}
                                    filePath={issue.file_path || issue.file}
                                    badge="SUGGESTED PATCH"
                                    badgeVariant="success"
                                />
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* Tool Evidence */}
            <div
                className="mb-4"
                style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 16,
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                <div
                    className="p-3 px-4 fw-bold d-flex align-items-center"
                    style={{
                        background: 'var(--surface-card-elevated)',
                        borderBottom: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                    }}
                >
                    <FaTools className="me-2" size={13} /> Tool Evidence
                </div>
                <div className="p-4">
                    {issue.evidence ? (
                        <CodeSnippetBlock
                            code={typeof issue.evidence === 'object' ? JSON.stringify(issue.evidence, null, 2) : String(issue.evidence)}
                            language="json"
                            badge="EVIDENCE"
                            badgeVariant="secondary"
                            maxHeight={320}
                        />
                    ) : (
                        <p className="text-muted mb-0">No raw tool evidence available.</p>
                    )}
                    <div className="mt-3 text-muted small">
                        Detected by analyzer: <strong style={{ color: 'var(--text-primary)' }}>{issue.tool || "Unknown Tool"}</strong>
                    </div>
                </div>
            </div>
        </Container>
    );
};

export default IssueDetail;
