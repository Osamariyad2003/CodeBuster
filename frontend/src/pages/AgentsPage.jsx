import React, { useState, useEffect, useMemo } from 'react';
import { Container, Card, Row, Col, Badge, Button, Spinner, Alert, Table, ProgressBar, Form } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaRobot, FaBug, FaCheckCircle, FaPlayCircle, FaExternalLinkAlt, FaShieldAlt, FaVial, FaGithub, FaBrain } from 'react-icons/fa';
import { apiClient } from '../lib/apiClient';
import { useToast } from '../components/ToastProvider';

const SECURITY_CATEGORIES = new Set([
    'secret_leak',
    'high_entropy_secret',
    'sql_injection',
    'xss',
    'command_injection',
    'path_traversal',
    'insecure_deserialization',
    'weak_crypto',
]);

const isSecurityIssue = (issue) => {
    const cat = (issue.category || '').toLowerCase();
    const mod = (issue.module || '').toLowerCase();
    return SECURITY_CATEGORIES.has(cat) || mod === 'security';
};

const TEST_CATEGORIES = new Set([
    'low_test_coverage',
    'missing_tests',
    'untested_function',
    'test_coverage',
]);

const isTestCoverageIssue = (issue) => {
    const cat = (issue.category || '').toLowerCase();
    const mod = (issue.module || '').toLowerCase();
    const title = (issue.title || '').toLowerCase();
    return (
        TEST_CATEGORIES.has(cat) ||
        mod === 'testing' ||
        mod === 'coverage' ||
        title.includes('test coverage') ||
        title.includes('untested')
    );
};

// AI Senior-Engineer findings come from the ai_agent_analyzer dimension.
// The orchestrator stamps these with module='ai' and tool='dimension_ai',
// and the analyzer emits ids prefixed with 'ai-agent-'.
const isAIAgentIssue = (issue) => {
    const mod = (issue.module || '').toLowerCase();
    const tool = (issue.tool || '').toLowerCase();
    const id = (issue.id || '').toString();
    return mod === 'ai' || tool === 'dimension_ai' || id.startsWith('ai-agent-');
};

/**
 * Premium agent card. Renders with a top accent stripe in the gradient color,
 * a soft tinted icon medallion, refined stat blocks, and a hover-lift effect.
 *
 * Props:
 *   icon          react-icons component
 *   gradient      [startColor, endColor] for the top stripe + icon medallion
 *   title         heading text
 *   description   short paragraph
 *   stats         [{ label, value, accent? }]   accent: optional CSS color for the value text
 *   buttonVariant bootstrap variant for the CTA
 *   buttonIcon    icon component for the CTA
 *   buttonLabel   text for the CTA
 *   onOpen        click handler
 *   comingSoon    if true, renders muted/disabled state with no CTA
 */
const AgentCard = ({
    icon: Icon,
    gradient,
    title,
    description,
    stats = [],
    buttonVariant = 'primary',
    buttonIcon: BtnIcon = FaPlayCircle,
    buttonLabel = 'Open',
    onOpen,
    comingSoon = false,
}) => {
    const [hover, setHover] = React.useState(false);
    const [g1, g2] = gradient || ['#6B7280', '#9CA3AF'];
    return (
        <div
            onMouseEnter={() => !comingSoon && setHover(true)}
            onMouseLeave={() => !comingSoon && setHover(false)}
            className="h-100 d-flex flex-column"
            style={{
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: hover
                    ? '0 6px 20px rgba(0, 0, 0, 0.08)'
                    : '0 1px 2px rgba(0, 0, 0, 0.02)',
                transform: hover ? 'translateY(-2px)' : 'none',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                opacity: comingSoon ? 0.7 : 1,
            }}
        >
            {/* Top accent stripe */}
            <div
                aria-hidden
                style={{
                    height: 4,
                    background: comingSoon
                        ? '#E5E7EB'
                        : `linear-gradient(90deg, ${g1}, ${g2})`,
                }}
            />

            <div className="p-4 d-flex flex-column flex-grow-1">
                {/* Header: icon + title */}
                <div className="d-flex align-items-center mb-3">
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: comingSoon
                                ? '#F3F4F6'
                                : `linear-gradient(135deg, ${g1}, ${g2})`,
                            color: comingSoon ? '#9CA3AF' : 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                            boxShadow: comingSoon ? 'none' : `0 6px 16px ${g1}33`,
                            flexShrink: 0,
                        }}
                    >
                        <Icon size={22} />
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <h5 className="fw-bold mb-1" style={{ color: '#111827', fontSize: '1rem' }}>
                            {title}
                        </h5>
                        {comingSoon ? (
                            <Badge bg="secondary" pill style={{ fontSize: '0.65rem' }}>
                                Coming soon
                            </Badge>
                        ) : (
                            <span
                                className="d-inline-flex align-items-center"
                                style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: '#059669',
                                    gap: 5,
                                }}
                            >
                                <span
                                    aria-hidden
                                    style={{
                                        display: 'inline-block',
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: '#10B981',
                                        boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.18)',
                                    }}
                                />
                                Active
                            </span>
                        )}
                    </div>
                </div>

                {/* Description */}
                <p
                    className="small mb-3"
                    style={{ color: '#6B7280', lineHeight: 1.5 }}
                >
                    {description}
                </p>

                {/* Stats */}
                {stats.length > 0 && (
                    <div className="d-flex gap-2 mb-3">
                        {stats.map((s, i) => (
                            <div
                                key={i}
                                className="flex-grow-1 px-2 py-2 text-center"
                                style={{
                                    background: '#F9FAFB',
                                    border: '1px solid #F3F4F6',
                                    borderRadius: 8,
                                }}
                            >
                                <div
                                    className="fw-bold"
                                    style={{
                                        color: s.accent || '#111827',
                                        fontSize: '1.1rem',
                                        lineHeight: 1.1,
                                    }}
                                >
                                    {s.value}
                                </div>
                                <div
                                    className="text-muted"
                                    style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                        marginTop: 3,
                                    }}
                                >
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* CTA */}
                {!comingSoon && (
                    <Button
                        variant={buttonVariant}
                        className="w-100 d-flex align-items-center justify-content-center mt-auto"
                        onClick={onOpen}
                    >
                        <BtnIcon size={12} className="me-2" /> {buttonLabel}
                    </Button>
                )}
            </div>
        </div>
    );
};

const BugFixAgentCard = ({ onOpen, stats }) => (
    <AgentCard
        icon={FaBug}
        gradient={['#4F46E5', '#06B6D4']}
        title="Bug Fix Agent"
        description="Automatically generates patches for detected issues, creates a branch on GitHub, and commits the fix for your review."
        stats={[
            { label: 'Open', value: stats.open },
            { label: 'Resolved', value: stats.resolved, accent: '#059669' },
        ]}
        buttonVariant="primary"
        buttonIcon={FaPlayCircle}
        buttonLabel="View fixable issues"
        onOpen={onOpen}
    />
);

const SecurityAgentCard = ({ onOpen, stats }) => (
    <AgentCard
        icon={FaShieldAlt}
        gradient={['#DC2626', '#F59E0B']}
        title="Security Agent"
        description="Scans for secret leaks, injection flaws, and crypto weaknesses. Opens remediation PRs in a single batch."
        stats={[
            { label: 'Critical', value: stats.critical, accent: '#DC2626' },
            { label: 'Open', value: stats.open },
            { label: 'Resolved', value: stats.resolved, accent: '#059669' },
        ]}
        buttonVariant="danger"
        buttonIcon={FaShieldAlt}
        buttonLabel="View security issues"
        onOpen={onOpen}
    />
);

const TestCoverageAgentCard = ({ onOpen, stats }) => (
    <AgentCard
        icon={FaVial}
        gradient={['#059669', '#14B8A6']}
        title="Test Coverage Agent"
        description="Flags uncovered functions and classes, and proposes unit tests you can commit as a single PR."
        stats={[
            { label: 'Gaps', value: stats.open },
            { label: 'Resolved', value: stats.resolved, accent: '#059669' },
        ]}
        buttonVariant="success"
        buttonIcon={FaVial}
        buttonLabel="View coverage gaps"
        onOpen={onOpen}
    />
);

// eslint-disable-next-line no-unused-vars
const ComingSoonCard = ({ icon, title, description }) => (
    <AgentCard
        icon={icon}
        title={title}
        description={description}
        comingSoon
    />
);

const AgentsPage = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    const [view, setView] = useState('agents');
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState({});
    const [batchProgress, setBatchProgress] = useState(null);
    const [selectedRepo, setSelectedRepo] = useState(() => searchParams.get('repo') || 'all');

    // Keep URL in sync with selectedRepo so the view is deep-linkable and survives refresh
    useEffect(() => {
        const current = searchParams.get('repo') || 'all';
        if (current === selectedRepo) return;
        const next = new URLSearchParams(searchParams);
        if (selectedRepo === 'all') {
            next.delete('repo');
        } else {
            next.set('repo', selectedRepo);
        }
        setSearchParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRepo]);

    // If the URL changes externally (e.g. clicking an Agents link from RepoListPage), reflect it in state
    useEffect(() => {
        const urlRepo = searchParams.get('repo') || 'all';
        if (urlRepo !== selectedRepo) setSelectedRepo(urlRepo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const fetchIssues = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/api/issues?limit=200');
            setIssues(res.data || []);
        } catch (err) {
            showToast('Failed to load issues', 'danger');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIssues();
    }, []);

    // Unique repo names across all issues (drives the selector)
    const repoOptions = useMemo(() => {
        const names = new Set();
        issues.forEach(i => {
            if (i.repo_name) names.add(i.repo_name);
        });
        return Array.from(names).sort();
    }, [issues]);

    // Filter the working issue list by selected repo
    const filteredIssues = useMemo(() => {
        if (selectedRepo === 'all') return issues;
        return issues.filter(i => i.repo_name === selectedRepo);
    }, [issues, selectedRepo]);

    const stats = {
        open: filteredIssues.filter(i => i.status !== 'resolved').length,
        resolved: filteredIssues.filter(i => i.status === 'resolved').length
    };

    const securityIssues = useMemo(() => filteredIssues.filter(isSecurityIssue), [filteredIssues]);

    const securityStats = useMemo(() => ({
        open: securityIssues.filter(i => i.status !== 'resolved').length,
        resolved: securityIssues.filter(i => i.status === 'resolved').length,
        critical: securityIssues.filter(i => i.severity === 'critical' && i.status !== 'resolved').length
    }), [securityIssues]);

    const coverageIssues = useMemo(() => filteredIssues.filter(isTestCoverageIssue), [filteredIssues]);

    const coverageStats = useMemo(() => ({
        open: coverageIssues.filter(i => i.status !== 'resolved').length,
        resolved: coverageIssues.filter(i => i.status === 'resolved').length,
    }), [coverageIssues]);

    // Per-repo counts for the selector
    const repoCounts = useMemo(() => {
        const map = {};
        issues.forEach(i => {
            if (!i.repo_name) return;
            map[i.repo_name] = (map[i.repo_name] || 0) + 1;
        });
        return map;
    }, [issues]);

    // If someone deep-linked to a repo with zero issues, still show it in the dropdown
    const displayOptions = useMemo(() => {
        if (selectedRepo === 'all' || repoOptions.includes(selectedRepo)) return repoOptions;
        return [selectedRepo, ...repoOptions].sort();
    }, [repoOptions, selectedRepo]);

    // Reusable repo filter UI (called as a function so it isn't remounted on every parent render)
    const renderRepoFilter = () => (
        <div
            className="d-flex align-items-center gap-3 mb-4 px-3 py-2"
            style={{
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            }}
        >
            <div
                style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: selectedRepo === 'all' ? '#F3F4F6' : 'rgba(79, 70, 229, 0.12)',
                    color: selectedRepo === 'all' ? '#6B7280' : '#4F46E5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                <FaGithub size={14} />
            </div>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Repository
                </div>
                <Form.Select
                    size="sm"
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    className="border-0 px-0 fw-semibold"
                    style={{ boxShadow: 'none', background: 'transparent', color: '#111827' }}
                >
                    <option value="all">All repositories ({issues.length})</option>
                    {displayOptions.map(name => (
                        <option key={name} value={name}>
                            {name} ({repoCounts[name] || 0})
                        </option>
                    ))}
                </Form.Select>
            </div>
            {selectedRepo !== 'all' && (
                <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => setSelectedRepo('all')}
                    className="d-flex align-items-center"
                    style={{ fontSize: '0.75rem' }}
                >
                    Clear filter
                </Button>
            )}
        </div>
    );

    const runFix = async (issue) => {
        setRunning(prev => ({ ...prev, [issue.id]: true }));
        try {
            const res = await apiClient.post('/github/fix/apply', {
                issue_id: issue.id,
                review_id: issue.review_id
            });
            if (res.success) {
                showToast(`Fix committed on branch ${res.branch}`, 'success');
                fetchIssues();
                return true;
            } else {
                showToast(res.error || 'Fix failed', 'danger');
                return false;
            }
        } catch (err) {
            showToast(err?.userMessage || 'Failed to apply fix', 'danger');
            return false;
        } finally {
            setRunning(prev => ({ ...prev, [issue.id]: false }));
        }
    };

    const runBatch = async (issueList, label) => {
        const targets = issueList.filter(i => i.status !== 'resolved');
        if (targets.length === 0) return;
        setBatchProgress({ total: targets.length, done: 0, succeeded: 0, failed: 0, label });
        for (let i = 0; i < targets.length; i++) {
            const ok = await runFix(targets[i]);
            setBatchProgress(prev => prev && ({
                ...prev,
                done: prev.done + 1,
                succeeded: prev.succeeded + (ok ? 1 : 0),
                failed: prev.failed + (ok ? 0 : 1)
            }));
        }
        showToast(`${label} batch complete`, 'info');
        setTimeout(() => setBatchProgress(null), 4000);
    };

    const fixAllSecurity = () => runBatch(securityIssues, 'Security');
    const fixAllCoverage = () => runBatch(coverageIssues, 'Test coverage');

    if (view === 'coverage') {
        const openTargets = coverageIssues.filter(i => i.status !== 'resolved');
        const batchRunning = batchProgress && batchProgress.done < batchProgress.total;
        return (
            <Container className="py-4" style={{ maxWidth: 1100 }}>
                <Button variant="link" onClick={() => setView('agents')} className="ps-0 text-decoration-none text-muted mb-3">
                    ← Back to Agents
                </Button>
                <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                        <FaVial size={28} className="text-success me-3" />
                        <div>
                            <h3 className="fw-bold mb-0">Test Coverage Agent</h3>
                            <div className="text-muted small">
                                Uncovered functions and files flagged by the analyzer
                                {selectedRepo !== 'all' && <> · <strong>{selectedRepo}</strong></>}
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="success"
                        disabled={openTargets.length === 0 || batchRunning}
                        onClick={fixAllCoverage}
                    >
                        {batchRunning ? (
                            <><Spinner size="sm" animation="border" className="me-2" />Fixing {batchProgress.done}/{batchProgress.total}…</>
                        ) : (
                            <><FaVial className="me-2" />Generate All ({openTargets.length})</>
                        )}
                    </Button>
                </div>

                {renderRepoFilter()}

                {batchProgress && (
                    <div className="mb-3">
                        <ProgressBar
                            now={(batchProgress.done / batchProgress.total) * 100}
                            label={`${batchProgress.done}/${batchProgress.total}`}
                            variant={batchProgress.failed > 0 ? 'warning' : 'success'}
                        />
                        <div className="small text-muted mt-1">
                            {batchProgress.succeeded} succeeded · {batchProgress.failed} failed
                        </div>
                    </div>
                )}

                <Alert variant="info" className="small">
                    Test generation currently uses the analyzer's suggested_fix. If no patch
                    is provided, &quot;Run Fix&quot; will tell you it couldn&apos;t produce one — in that
                    case add the test manually and mark the issue resolved.
                </Alert>

                {loading ? (
                    <div className="text-center py-5"><Spinner animation="border" /></div>
                ) : coverageIssues.length === 0 ? (
                    <Alert variant="success">No test-coverage gaps flagged. 🎉</Alert>
                ) : (
                    <Card className="border-0 shadow-sm">
                        <Table hover responsive className="mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th>Target</th>
                                    <th>Severity</th>
                                    <th>File</th>
                                    <th>Status</th>
                                    <th className="text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coverageIssues.map(issue => (
                                    <tr key={issue.id}>
                                        <td>
                                            <div className="fw-semibold">{issue.title || issue.message}</div>
                                            <div className="text-muted small">{issue.repo_name}</div>
                                        </td>
                                        <td>
                                            <Badge bg={issue.severity === 'critical' ? 'danger' : issue.severity === 'major' ? 'warning' : 'secondary'}>
                                                {issue.severity}
                                            </Badge>
                                        </td>
                                        <td className="small text-monospace">
                                            {issue.file_path}{issue.line_number ? `:${issue.line_number}` : ''}
                                        </td>
                                        <td>
                                            {issue.status === 'resolved' ? (
                                                <Badge bg="success"><FaCheckCircle className="me-1" />Resolved</Badge>
                                            ) : (
                                                <Badge bg="light" text="dark">Open</Badge>
                                            )}
                                        </td>
                                        <td className="text-end">
                                            <Button
                                                size="sm"
                                                variant="outline-secondary"
                                                className="me-2"
                                                onClick={() => navigate(`/issues/${issue.id}`)}
                                            >
                                                <FaExternalLinkAlt size={12} />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="success"
                                                disabled={issue.status === 'resolved' || running[issue.id] || batchRunning}
                                                onClick={() => runFix(issue)}
                                            >
                                                {running[issue.id] ? (
                                                    <><Spinner size="sm" animation="border" className="me-2" />Fixing…</>
                                                ) : (
                                                    <><FaPlayCircle className="me-1" />Generate Test</>
                                                )}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card>
                )}
            </Container>
        );
    }

    if (view === 'security') {
        const openTargets = securityIssues.filter(i => i.status !== 'resolved');
        const batchRunning = batchProgress && batchProgress.done < batchProgress.total;
        return (
            <Container className="py-4" style={{ maxWidth: 1100 }}>
                <Button variant="link" onClick={() => setView('agents')} className="ps-0 text-decoration-none text-muted mb-3">
                    ← Back to Agents
                </Button>
                <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                        <FaShieldAlt size={28} className="text-danger me-3" />
                        <div>
                            <h3 className="fw-bold mb-0">Security Agent</h3>
                            <div className="text-muted small">
                                Secret leaks, injections, and crypto weaknesses
                                {selectedRepo !== 'all' && <> · <strong>{selectedRepo}</strong></>}
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="danger"
                        disabled={openTargets.length === 0 || batchRunning}
                        onClick={fixAllSecurity}
                    >
                        {batchRunning ? (
                            <><Spinner size="sm" animation="border" className="me-2" />Fixing {batchProgress.done}/{batchProgress.total}…</>
                        ) : (
                            <><FaShieldAlt className="me-2" />Fix All ({openTargets.length})</>
                        )}
                    </Button>
                </div>

                {renderRepoFilter()}

                {batchProgress && (
                    <div className="mb-3">
                        <ProgressBar
                            now={(batchProgress.done / batchProgress.total) * 100}
                            label={`${batchProgress.done}/${batchProgress.total}`}
                            variant={batchProgress.failed > 0 ? 'warning' : 'success'}
                        />
                        <div className="small text-muted mt-1">
                            {batchProgress.succeeded} succeeded · {batchProgress.failed} failed
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-5"><Spinner animation="border" /></div>
                ) : securityIssues.length === 0 ? (
                    <Alert variant="success">No security issues detected. 🎉</Alert>
                ) : (
                    <Card className="border-0 shadow-sm">
                        <Table hover responsive className="mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th>Issue</th>
                                    <th>Category</th>
                                    <th>Severity</th>
                                    <th>File</th>
                                    <th>Status</th>
                                    <th className="text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {securityIssues.map(issue => (
                                    <tr key={issue.id}>
                                        <td>
                                            <div className="fw-semibold">{issue.title || issue.message}</div>
                                            <div className="text-muted small">{issue.repo_name}</div>
                                        </td>
                                        <td>
                                            <Badge bg="light" text="dark" className="text-uppercase small">
                                                {(issue.category || 'security').replace(/_/g, ' ')}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Badge bg={issue.severity === 'critical' ? 'danger' : issue.severity === 'major' ? 'warning' : 'secondary'}>
                                                {issue.severity}
                                            </Badge>
                                        </td>
                                        <td className="small text-monospace">
                                            {issue.file_path}:{issue.line_number}
                                        </td>
                                        <td>
                                            {issue.status === 'resolved' ? (
                                                <Badge bg="success"><FaCheckCircle className="me-1" />Resolved</Badge>
                                            ) : (
                                                <Badge bg="light" text="dark">Open</Badge>
                                            )}
                                        </td>
                                        <td className="text-end">
                                            <Button
                                                size="sm"
                                                variant="outline-secondary"
                                                className="me-2"
                                                onClick={() => navigate(`/issues/${issue.id}`)}
                                            >
                                                <FaExternalLinkAlt size={12} />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                disabled={issue.status === 'resolved' || running[issue.id] || batchRunning}
                                                onClick={() => runFix(issue)}
                                            >
                                                {running[issue.id] ? (
                                                    <><Spinner size="sm" animation="border" className="me-2" />Fixing…</>
                                                ) : (
                                                    <><FaPlayCircle className="me-1" />Run Fix</>
                                                )}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card>
                )}
            </Container>
        );
    }

    if (view === 'bugfix') {
        return (
            <Container className="py-4" style={{ maxWidth: 1100 }}>
                <Button variant="link" onClick={() => setView('agents')} className="ps-0 text-decoration-none text-muted mb-3">
                    ← Back to Agents
                </Button>
                <div className="d-flex align-items-center mb-4">
                    <FaBug size={28} className="text-primary me-3" />
                    <div>
                        <h3 className="fw-bold mb-0">Bug Fix Agent</h3>
                        <div className="text-muted small">
                            Select an issue to generate and commit a fix automatically
                            {selectedRepo !== 'all' && <> · <strong>{selectedRepo}</strong></>}
                        </div>
                    </div>
                </div>

                {renderRepoFilter()}

                {loading ? (
                    <div className="text-center py-5"><Spinner animation="border" /></div>
                ) : filteredIssues.length === 0 ? (
                    <Alert variant="info">
                        {selectedRepo === 'all'
                            ? 'No issues found. Run a review first.'
                            : <>No issues found for <strong>{selectedRepo}</strong>.</>}
                    </Alert>
                ) : (
                    <Card className="border-0 shadow-sm">
                        <Table hover responsive className="mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th>Issue</th>
                                    <th>Severity</th>
                                    <th>File</th>
                                    <th>Status</th>
                                    <th className="text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredIssues.map(issue => (
                                    <tr key={issue.id}>
                                        <td>
                                            <div className="fw-semibold">{issue.title || issue.message}</div>
                                            <div className="text-muted small">{issue.repo_name}</div>
                                        </td>
                                        <td>
                                            <Badge bg={issue.severity === 'critical' ? 'danger' : issue.severity === 'major' ? 'warning' : 'secondary'}>
                                                {issue.severity}
                                            </Badge>
                                        </td>
                                        <td className="small text-monospace">
                                            {issue.file_path}:{issue.line_number}
                                        </td>
                                        <td>
                                            {issue.status === 'resolved' ? (
                                                <Badge bg="success"><FaCheckCircle className="me-1" />Resolved</Badge>
                                            ) : (
                                                <Badge bg="light" text="dark">Open</Badge>
                                            )}
                                        </td>
                                        <td className="text-end">
                                            <Button
                                                size="sm"
                                                variant="outline-secondary"
                                                className="me-2"
                                                onClick={() => navigate(`/issues/${issue.id}`)}
                                            >
                                                <FaExternalLinkAlt size={12} />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                disabled={issue.status === 'resolved' || running[issue.id]}
                                                onClick={() => runFix(issue)}
                                            >
                                                {running[issue.id] ? (
                                                    <><Spinner size="sm" animation="border" className="me-2" />Fixing...</>
                                                ) : (
                                                    <><FaPlayCircle className="me-1" />Run Fix</>
                                                )}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card>
                )}
            </Container>
        );
    }

    return (
        <Container className="py-4" style={{ maxWidth: 1100 }}>
            <div className="d-flex align-items-center mb-4">
                <FaRobot size={28} className="text-primary me-3" />
                <div>
                    <h3 className="fw-bold mb-0">Agents</h3>
                    <div className="text-muted small">Autonomous workers that review, fix, and maintain your code</div>
                </div>
            </div>

            {renderRepoFilter()}

            {selectedRepo !== 'all' && filteredIssues.length === 0 && (
                <div
                    className="d-flex align-items-center gap-3 px-3 py-3 mb-4"
                    style={{
                        background: 'rgba(79, 70, 229, 0.04)',
                        border: '1px solid rgba(79, 70, 229, 0.15)',
                        borderRadius: 10,
                    }}
                >
                    <div
                        style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: 'rgba(79, 70, 229, 0.12)',
                            color: '#4F46E5',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <FaCheckCircle size={16} />
                    </div>
                    <div className="flex-grow-1 small">
                        No issues found for <strong>{selectedRepo}</strong>. Run a review from the Commits inbox to scan for new findings.
                    </div>
                    <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => navigate('/commits')}
                        className="flex-shrink-0"
                    >
                        Open Commits
                    </Button>
                </div>
            )}

            <Row className="g-3">
                <Col md={6} lg={4}>
                    <BugFixAgentCard onOpen={() => setView('bugfix')} stats={stats} />
                </Col>
                <Col md={6} lg={4}>
                    <SecurityAgentCard onOpen={() => setView('security')} stats={securityStats} />
                </Col>
                <Col md={6} lg={4}>
                    <TestCoverageAgentCard onOpen={() => setView('coverage')} stats={coverageStats} />
                </Col>
            </Row>
        </Container>
    );
};

export default AgentsPage;
