import React, { useState, useEffect } from 'react';
import { Offcanvas, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import { FaTimes, FaPlayCircle, FaExternalLinkAlt, FaEye, FaCheck, FaBrain, FaLightbulb, FaCodeBranch, FaGithub, FaRocket } from 'react-icons/fa';

/** Renders the ai_explanation string with bold, inline-code, and paragraph support. */
function ExplanationRenderer({ text }) {
    if (!text) return null;

    // Strip trailing metadata note like "(Explanation generated from CodeBuster's rule library...)"
    const clean = text.replace(/\n*\(Explanation generated from CodeBuster['']s rule library[^)]*\)/gi, '').trim();

    // Split into paragraphs on blank lines
    const paragraphs = clean.split(/\n{2,}/);

    const renderInline = (str, keyPrefix) => {
        // Split on **bold** and `code`
        const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return parts.map((p, i) => {
            if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={`${keyPrefix}-b${i}`}>{p.slice(2, -2)}</strong>;
            if (p.startsWith('`') && p.endsWith('`'))
                return (
                    <code key={`${keyPrefix}-c${i}`} style={{
                        background: 'rgba(79,70,229,0.08)', color: '#4F46E5',
                        padding: '1px 5px', borderRadius: 4, fontSize: '0.85em',
                    }}>{p.slice(1, -1)}</code>
                );
            return <span key={`${keyPrefix}-s${i}`}>{p}</span>;
        });
    };

    const renderParagraph = (para, idx) => {
        const lines = para.split('\n');

        // Numbered list
        if (lines.every(l => /^\d+\.\s/.test(l.trim()) || l.trim() === '')) {
            return (
                <ol key={idx} style={{ paddingLeft: 20, margin: '0 0 8px' }}>
                    {lines.filter(l => l.trim()).map((l, i) => (
                        <li key={i} style={{ marginBottom: 4, lineHeight: 1.6 }}>
                            {renderInline(l.replace(/^\d+\.\s*/, ''), `${idx}-li${i}`)}
                        </li>
                    ))}
                </ol>
            );
        }

        // Bullet list
        if (lines.every(l => /^[-•*]\s/.test(l.trim()) || l.trim() === '')) {
            return (
                <ul key={idx} style={{ paddingLeft: 20, margin: '0 0 8px' }}>
                    {lines.filter(l => l.trim()).map((l, i) => (
                        <li key={i} style={{ marginBottom: 4, lineHeight: 1.6 }}>
                            {renderInline(l.replace(/^[-•*]\s*/, ''), `${idx}-li${i}`)}
                        </li>
                    ))}
                </ul>
            );
        }

        // Normal paragraph — join lines with space
        return (
            <p key={idx} style={{ margin: '0 0 8px', lineHeight: 1.65 }}>
                {renderInline(lines.join(' '), `${idx}`)}
            </p>
        );
    };

    return (
        <div
            style={{
                background: 'linear-gradient(135deg, rgba(14,165,233,0.05), rgba(79,70,229,0.04))',
                border: '1px solid rgba(14,165,233,0.18)',
                borderRadius: 10,
                padding: '14px 16px',
                fontSize: '0.875rem',
                color: '#1E293B',
            }}
        >
            <div className="d-flex align-items-center gap-2 mb-2">
                <FaLightbulb size={12} style={{ color: '#0EA5E9', flexShrink: 0 }} />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0EA5E9' }}>
                    AI Explanation
                </span>
            </div>
            {paragraphs.map(renderParagraph)}
        </div>
    );
}
import FixPreviewPanel from './FixPreviewPanel';
import SectionLabel from './SectionLabel';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../ToastProvider';

const severityVariant = (severity) => {
    const s = (severity || '').toLowerCase();
    if (s === 'critical') return 'danger';
    if (s === 'major') return 'warning';
    if (s === 'minor') return 'info';
    return 'secondary';
};

const confidenceLabel = (conf) => {
    if (conf == null) return '—';
    if (conf >= 0.8) return 'High';
    if (conf >= 0.5) return 'Medium';
    return 'Low';
};

// Map LLM-emitted tag strings to a CSS color so the chips are visually
// distinct (race-conditions are red, edge-cases are blue, etc.). Falls back
// to neutral gray for any tag we haven't seen.
const TAG_COLORS = {
    'race-condition': '#DC2626',
    'race condition': '#DC2626',
    'concurrency': '#DC2626',
    'deadlock': '#DC2626',
    'business-logic': '#F59E0B',
    'business logic': '#F59E0B',
    'logic-error': '#F59E0B',
    'edge-case': '#0EA5E9',
    'edge case': '#0EA5E9',
    'null': '#0EA5E9',
    'security': '#7C3AED',
    'authz': '#7C3AED',
    'authorization': '#7C3AED',
    'leak': '#7C3AED',
    'performance': '#0D9488',
    'n+1': '#0D9488',
    'memory': '#0D9488',
    'architecture': '#6366F1',
    'coupling': '#6366F1',
    'abstraction': '#6366F1',
};

const tagColor = (tag) => TAG_COLORS[(tag || '').toLowerCase()] || '#6B7280';

// True if this issue came from the AI Agent (Senior Engineer) analyzer.
// The orchestrator stamps these with module='ai' or tool='dimension_ai'.
const isAIAgentFinding = (issue) =>
    issue?.module === 'ai' ||
    issue?.tool === 'dimension_ai' ||
    (typeof issue?.id === 'string' && issue.id.startsWith('ai-agent-'));


/**
 * Drawer for issue/finding: evidence, impact, recommendation.
 * Supports legacy issue (file, line_number, evidence[], suggested_fix) and canonical finding (evidence.snippets[], recommendation.summary/steps, locations[]).
 * Props: { show, onHide, issue: object | null, canonicalFinding?: boolean }
 */
export default function IssueDetailDrawer({ show, onHide, issue: issueProp, canonicalFinding = false, onFixed, onIssueUpdated }) {
    const [running, setRunning] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [preview, setPreview] = useState(null);
    const [previewError, setPreviewError] = useState(null);
    // Set alongside previewError when the backend attributes the failure to
    // a specific AI provider issue (rate limit, bad key, provider down) so
    // the alert can say *why*, not just that it failed.
    const [previewErrorMeta, setPreviewErrorMeta] = useState(null);
    // Set when the backend's preview returns `comment_only_fix: true` so we
    // can offer the "Enhance with AI" button instead of just an error.
    const [previewIsCommentOnly, setPreviewIsCommentOnly] = useState(false);
    const [enhancing, setEnhancing] = useState(false);
    const [fixResult, setFixResult] = useState(null);
    // Locally mirror the issue prop so post-enhancement updates render
    // immediately without requiring the parent to refetch.
    const [issue, setIssue] = useState(issueProp);
    useEffect(() => { setIssue(issueProp); }, [issueProp]);
    const { showToast } = useToast();

    if (!issue) return null;

    const isCanonical = canonicalFinding || (issue.evidence && Array.isArray(issue.evidence.snippets));
    const snippets = isCanonical && issue.evidence?.snippets ? issue.evidence.snippets : [];
    const recommendation = issue.recommendation;
    const locations = issue.locations || [];
    const loc0 = locations[0];
    const filePath = loc0?.file_path ?? issue.file_path ?? issue.file;
    const lineNum = loc0?.start_line ?? issue.line_number;

    const issueId = issue.id;
    const reviewId = issue.review_id;
    const alreadyResolved = (issue.status || '').toLowerCase() === 'resolved';
    // Mirrors backend fix_service._SECRET_CATEGORIES — secret findings get a
    // redaction fix even though they have no suggested_fix.code/content.
    const isSecretFinding = ['secret_leak', 'high_entropy_secret'].includes((issue.category || '').toLowerCase());
    const hasFixCode = Boolean(issue.suggested_fix?.code || issue.suggested_fix?.content) || isSecretFinding;
    const canRunFix = Boolean(issueId) && !alreadyResolved && hasFixCode;

    const loadPreview = async () => {
        if (!canRunFix || previewing) return;
        setPreviewing(true);
        setPreviewError(null);
        setPreviewErrorMeta(null);
        setPreviewIsCommentOnly(false);
        setPreview(null);
        setFixResult(null);
        try {
            const res = await apiClient.post(
                '/github/fix/preview',
                {
                    issue_id: issueId,
                    review_id: reviewId,
                },
                // Don't fire the global "session expired" toast on legitimate
                // 400s like comment-only-fix; we surface our own UI here.
                { skipAuthHandler: true }
            );
            if (res?.success) {
                setPreview(res);
            } else {
                const err = res?.error || 'Failed to generate preview';
                setPreviewError(err);
                if (res?.comment_only_fix) {
                    setPreviewIsCommentOnly(true);
                } else {
                    showToast(err, 'danger');
                }
            }
        } catch (err) {
            // apiClient rejects with a standardError that exposes the parsed
            // response body at err.body. Use it to detect comment_only_fix
            // and other backend-provided flags.
            const body = err?.body || err?.originalError?.response?.data || {};
            const msg = body.error || err?.message || 'Failed to generate preview';
            setPreviewError(msg);
            if (body.comment_only_fix) {
                setPreviewIsCommentOnly(true);
            } else {
                showToast(msg, 'danger');
            }
        } finally {
            setPreviewing(false);
        }
    };

    const cancelPreview = () => {
        setPreview(null);
        setPreviewError(null);
        setPreviewErrorMeta(null);
        setPreviewIsCommentOnly(false);
    };

    /**
     * On-demand AI enhancement for findings that didn't make the top-25
     * cutoff during the review. Calls the backend, which:
     *   - fetches the file from GitHub
     *   - runs AIReviewService.enhance_issue_with_retry
     *   - persists the new ai_explanation + suggested_fix on the row
     * Then we automatically re-trigger the preview, which now has real code.
     */
    const enhanceWithAI = async () => {
        if (!issueId || enhancing) return;
        setEnhancing(true);
        setPreviewError(null);
        setPreviewErrorMeta(null);
        try {
            const res = await apiClient.post(
                `/github/issues/${issueId}/enhance`,
                {},
                { skipAuthHandler: true }
            );
            if (!res?.success) {
                const msg = res?.error || 'AI enhancement failed';
                setPreviewError(msg);
                if (res?.ai_provider || res?.ai_error_type) {
                    setPreviewErrorMeta({ provider: res.ai_provider, errorType: res.ai_error_type, detail: res.ai_error_detail });
                }
                showToast(msg, 'danger');
                return;
            }
            // Refresh local view of the issue so the new ai_explanation,
            // recommendation, tags, etc. render immediately. The drawer's
            // section labels and AI Senior-Engineer banner derive from these.
            if (res.issue) {
                setIssue((prev) => ({ ...(prev || {}), ...res.issue }));
                if (typeof onIssueUpdated === 'function') {
                    try { onIssueUpdated(res.issue); } catch (_) { /* parent is optional */ }
                }
            }
            // If the user came in via the comment-only error, finish the loop
            // by re-running preview now that the LLM-generated code is on the
            // row. Otherwise just toast and let them choose what to do next.
            const wasFromCommentOnly = previewIsCommentOnly;
            setPreviewIsCommentOnly(false);
            if (wasFromCommentOnly) {
                showToast('AI enhancement applied — generating preview…', 'success');
                await loadPreview();
            } else {
                showToast('AI enhancement applied. Click Preview Fix to see the patch.', 'success');
            }
        } catch (err) {
            const body = err?.body || err?.originalError?.response?.data || {};
            const msg = body.error || err?.message || 'AI enhancement failed';
            setPreviewError(msg);
            if (body.ai_provider || body.ai_error_type) {
                setPreviewErrorMeta({ provider: body.ai_provider, errorType: body.ai_error_type, detail: body.ai_error_detail });
            }
            showToast(msg, 'danger');
        } finally {
            setEnhancing(false);
        }
    };

    const runFix = async () => {
        if (!canRunFix || running) return;
        setRunning(true);
        setFixResult(null);
        try {
            const res = await apiClient.post('/github/fix/apply', {
                issue_id: issueId,
                review_id: reviewId,
            });
            if (res?.success) {
                setFixResult({
                    success: true,
                    branch: res.branch,
                    url: res.url,
                    prUrl: res.pr_url,
                    prNumber: res.pr_number,
                    commitUrl: res.commit_url,
                    prWarning: res.pr_warning,
                });
                const toastMsg = res.pr_url
                    ? `Fix PR #${res.pr_number} opened`
                    : `Fix committed on branch ${res.branch}`;
                showToast(toastMsg, 'success');
                if (typeof onFixed === 'function') onFixed(issueId, res);
            } else {
                const err = res?.error || 'Fix failed';
                setFixResult({ success: false, error: err });
                showToast(err, 'danger');
            }
        } catch (err) {
            const msg = err?.userMessage || err?.message || 'Failed to apply fix';
            setFixResult({ success: false, error: msg });
            showToast(msg, 'danger');
        } finally {
            setRunning(false);
        }
    };

    return (
        <Offcanvas show={show} onHide={onHide} placement="end" className="w-100 w-md-50">
            <Offcanvas.Header closeButton>
                <Offcanvas.Title className="d-flex align-items-center gap-2 flex-wrap">
                    <Badge bg={severityVariant(issue.severity)}>{issue.severity || '—'}</Badge>
                    {(issue.dimension || issue.category) && (
                        <Badge bg="light" text="dark">{issue.dimension || issue.category}</Badge>
                    )}
                    {issue.confidence != null && (
                        <span className="small text-muted">Confidence: {confidenceLabel(issue.confidence)}</span>
                    )}
                    <span>{issue.title || 'Finding'}</span>
                </Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body>
                {/* AI Senior-Engineer banner — only renders for findings from
                    the new ai_agent_analyzer dimension. Sets the visual tone
                    so the user knows this is a deep-thinking finding, not a
                    static-tool flag. */}
                {isAIAgentFinding(issue) && (
                    <div
                        className="d-flex align-items-center gap-2 mb-3 px-3 py-2"
                        style={{
                            background: 'linear-gradient(90deg, rgba(79, 70, 229, 0.08), rgba(14, 165, 233, 0.05))',
                            border: '1px solid rgba(79, 70, 229, 0.18)',
                            borderRadius: 10,
                        }}
                    >
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #4F46E5, #06B6D4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                flexShrink: 0,
                                boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
                            }}
                        >
                            <FaBrain size={14} />
                        </div>
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    color: '#4F46E5',
                                }}
                            >
                                AI Senior Engineer
                            </div>
                            <div className="small text-muted">
                                Deep-thinking analyzer — reads the code itself for logic, race
                                conditions, and edge cases that static tools miss.
                            </div>
                        </div>
                    </div>
                )}

                {/* LLM-emitted tags (e.g. race-condition, business-logic, edge-case)
                    rendered as colored chips. Backend stuffs these on issue.tags
                    via Issue.extra_metadata. */}
                {Array.isArray(issue.tags) && issue.tags.length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mb-3">
                        {issue.tags.map((tag, idx) => {
                            const color = tagColor(tag);
                            return (
                                <span
                                    key={idx}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        background: color + '15',
                                        color,
                                        border: `1px solid ${color}40`,
                                        padding: '3px 10px',
                                        borderRadius: 999,
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        letterSpacing: '0.02em',
                                    }}
                                >
                                    {tag}
                                </span>
                            );
                        })}
                        {issue.effort && (
                            <span
                                title="Estimated effort"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    background: '#F3F4F6',
                                    color: '#374151',
                                    border: '1px solid #E5E7EB',
                                    padding: '3px 10px',
                                    borderRadius: 999,
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                }}
                            >
                                effort: {issue.effort}
                            </span>
                        )}
                    </div>
                )}

                {(filePath || lineNum != null) && (
                    <p className="small text-muted mb-2">
                        {filePath}
                        {lineNum != null && ` L${lineNum}${loc0?.end_line != null && loc0.end_line !== lineNum ? `–${loc0.end_line}` : ''}`}
                    </p>
                )}

                {issue.description && (
                    <div className="mb-4">
                        <SectionLabel accent="#4F46E5">Description</SectionLabel>
                        <p className="mb-0" style={{ whiteSpace: 'pre-wrap', color: '#111827' }}>
                            {issue.description}
                        </p>
                    </div>
                )}

                {issue.ai_explanation && (
                    <div className="mb-4">
                        <ExplanationRenderer text={issue.ai_explanation} />
                    </div>
                )}

                {issue.impact && issue.impact !== issue.description && (
                    <div className="mb-4">
                        <SectionLabel accent="#F59E0B">Impact</SectionLabel>
                        <p className="mb-0" style={{ whiteSpace: 'pre-wrap', color: '#111827' }}>
                            {issue.impact}
                        </p>
                    </div>
                )}

                {typeof issue.recommendation === 'string' && issue.recommendation.trim() && (
                    <div className="mb-4">
                        <SectionLabel accent="#059669">Recommendation</SectionLabel>
                        <p className="mb-0" style={{ whiteSpace: 'pre-wrap', color: '#111827' }}>
                            {issue.recommendation}
                        </p>
                    </div>
                )}

                {/* Canonical: evidence.snippets */}
                {snippets.length > 0 && (
                    <div className="mb-4">
                        <SectionLabel accent="#6366F1">Evidence</SectionLabel>
                        {snippets.map((sn, i) => (
                            <div key={i} className="mt-2 p-2 bg-light rounded small">
                                <div className="text-muted mb-1">
                                    {sn.file_path}
                                    {(sn.start_line != null || sn.end_line != null) && (
                                        <span> L{sn.start_line ?? '?'}{sn.end_line != null && sn.end_line !== sn.start_line ? `–${sn.end_line}` : ''}</span>
                                    )}
                                </div>
                                {sn.excerpt && (
                                    <pre className="mb-0 p-2 bg-dark text-light rounded" style={{ fontSize: '12px', overflow: 'auto', borderLeft: '3px solid #0d6efd' }}>
                                        {sn.excerpt}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* AI-Enhanced: code_snippet */}
                {issue.code_snippet && (
                    <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <SectionLabel accent="#6B7280">Code Context</SectionLabel>
                            <span className="text-muted small">
                                {issue.code_snippet.split('\n').length} lines
                                {issue.line_number ? ` · around line ${issue.line_number}` : ''}
                            </span>
                        </div>
                        <div className="mt-2 rounded overflow-hidden border">
                            <pre className="mb-0 p-3 bg-dark text-light" style={{
                                fontSize: '13px',
                                lineHeight: '1.5',
                                overflow: 'auto',
                                // Tall enough to show ~70 lines without internal scrolling
                                // (orchestrator now emits ~41-line snippets, AI emits 50+).
                                maxHeight: '1500px',
                                fontFamily: "'Fira Code', 'Courier New', monospace"
                            }}>
                                {issue.code_snippet.split('\n').map((line, idx) => {
                                    // Two marker styles in use:
                                    //   AI flow:           "<-- ISSUE" appended to the offending line
                                    //   Orchestrator flow: "--> " prefix after the "NN | " line number
                                    const hasAiMarker = line.includes('<-- ISSUE');
                                    const hasOrchMarker = /^\s*\d+\s*\|\s*-->/.test(line);
                                    const isIssue = hasAiMarker || hasOrchMarker;
                                    const cleanLine = line
                                        .replace('<-- ISSUE', '')
                                        .replace(/(\|\s*)-->\s?/, '$1');
                                    return (
                                        <div key={idx} style={{
                                            backgroundColor: isIssue ? 'rgba(220, 53, 69, 0.2)' : 'transparent',
                                            borderLeft: isIssue ? '4px solid #dc3545' : '4px solid transparent',
                                            paddingLeft: '8px',
                                            marginLeft: '-4px'
                                        }}>
                                            {cleanLine}
                                            {isIssue && <span style={{ color: '#dc3545', fontWeight: 'bold', marginLeft: '10px' }}>&lt;-- ISSUE</span>}
                                        </div>
                                    );
                                })}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Legacy: evidence as string[] */}
                {!isCanonical && issue.evidence && Array.isArray(issue.evidence) && issue.evidence.length > 0 && (
                    <div className="mb-4">
                        <SectionLabel accent="#6366F1">Evidence</SectionLabel>
                        <ul className="small mb-0">
                            {issue.evidence.map((e, i) => (
                                <li key={i}>{typeof e === 'string' ? e : JSON.stringify(e)}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Canonical: recommendation.summary + steps */}
                {recommendation && typeof recommendation === 'object' && (recommendation.summary || (recommendation.steps && recommendation.steps.length > 0)) && (
                    <div className="mb-4">
                        <SectionLabel accent="#059669">Recommendation</SectionLabel>
                        {recommendation.summary && (
                            <p className="mb-2" style={{ whiteSpace: 'pre-wrap', color: '#111827' }}>
                                {recommendation.summary}
                            </p>
                        )}
                        {recommendation.steps && recommendation.steps.length > 0 && (
                            <ol className="mb-0 small ps-3">
                                {recommendation.steps.map((step, i) => (
                                    <li key={i} className="mb-1">{step}</li>
                                ))}
                            </ol>
                        )}
                    </div>
                )}

                {/* AI-Enhanced: suggested_fix.content */}
                {issue.suggested_fix && issue.suggested_fix.content && (
                    <div className="mb-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <SectionLabel accent="#198754">Suggested Fix</SectionLabel>
                            <Badge bg="success" className="ms-2">Ready to apply</Badge>
                        </div>
                        <div className="rounded overflow-hidden border">
                            <pre className="mb-0 p-3 bg-dark text-success" style={{
                                fontSize: '13px',
                                lineHeight: '1.5',
                                overflow: 'auto',
                                // Match Code Context — full proposed patches can be 50+ lines.
                                maxHeight: '1500px',
                                borderLeft: '4px solid #198754',
                                fontFamily: "'Fira Code', 'Courier New', monospace"
                            }}>
                                {issue.suggested_fix.content}
                            </pre>
                        </div>
                        <p className="small text-muted mt-2 mb-0">
                            Review the fixed code carefully before applying it to your repository.
                        </p>
                    </div>
                )}

                {previewError && previewIsCommentOnly && (
                    <div
                        className="mb-3 p-3 d-flex align-items-start gap-3"
                        style={{
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.30)',
                            borderRadius: 10,
                        }}
                    >
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #4F46E5, #06B6D4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                flexShrink: 0,
                                boxShadow: '0 4px 10px rgba(79, 70, 229, 0.20)',
                            }}
                        >
                            <FaBrain size={14} />
                        </div>
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                            <div className="fw-semibold mb-1" style={{ color: '#92400E', fontSize: '0.92rem' }}>
                                This finding doesn't have a code-level fix yet
                            </div>
                            <div className="small mb-2" style={{ color: '#78350F' }}>
                                The deterministic analyzer only suggested a comment, which would
                                replace your real code. Run the AI Senior-Engineer pass on this
                                specific finding to generate a proper code patch.
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={enhanceWithAI}
                                disabled={enhancing || previewing}
                                className="d-flex align-items-center"
                            >
                                {enhancing ? (
                                    <>
                                        <Spinner size="sm" animation="border" className="me-2" />
                                        Enhancing with AI…
                                    </>
                                ) : (
                                    <>
                                        <FaBrain size={11} className="me-2" />
                                        Enhance with AI
                                    </>
                                )}
                            </Button>
                        </div>
                        <Button
                            variant="link"
                            className="text-muted text-decoration-none p-0"
                            style={{ fontSize: '1.1rem', lineHeight: 1 }}
                            onClick={() => {
                                setPreviewError(null);
                                setPreviewIsCommentOnly(false);
                            }}
                            aria-label="Dismiss"
                        >
                            ×
                        </Button>
                    </div>
                )}

                {previewError && !previewIsCommentOnly && (
                    <Alert
                        variant="danger"
                        className="mb-3"
                        dismissible
                        onClose={() => { setPreviewError(null); setPreviewErrorMeta(null); }}
                    >
                        <div>Could not generate preview: {previewError}</div>
                        {previewErrorMeta?.provider && (
                            <div className="small mt-1" style={{ opacity: 0.85 }}>
                                Provider: <strong>{previewErrorMeta.provider}</strong>
                                {previewErrorMeta.errorType && ` · ${previewErrorMeta.errorType.replace(/_/g, ' ')}`}
                            </div>
                        )}
                    </Alert>
                )}

                {preview && <FixPreviewPanel preview={preview} />}

                {/* ── Fix success card ── */}
                {fixResult?.success && (
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(22,163,74,0.08), rgba(34,197,94,0.04))',
                        border: '1px solid rgba(22,163,74,0.30)',
                        borderRadius: 12,
                        padding: '16px',
                        marginBottom: 16,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', flexShrink: 0,
                                boxShadow: '0 4px 12px rgba(22,163,74,0.30)',
                            }}>
                                <FaCheck size={14} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>Fix applied successfully</div>
                                <div style={{ fontSize: 11, color: '#166534' }}>
                                    {fixResult.prUrl ? `PR #${fixResult.prNumber} opened` : 'Branch pushed to GitHub'}
                                </div>
                            </div>
                            <Button variant="link" className="ms-auto p-0 text-muted" onClick={() => setFixResult(null)} style={{ fontSize: 16, lineHeight: 1 }}>×</Button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#166534' }}>
                                <FaCodeBranch size={11} style={{ flexShrink: 0 }} />
                                <code style={{ background: 'rgba(22,163,74,0.10)', padding: '2px 7px', borderRadius: 5, fontSize: 11, color: '#15803d' }}>
                                    {fixResult.branch}
                                </code>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {fixResult.prUrl && (
                                    <a href={fixResult.prUrl} target="_blank" rel="noreferrer"
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            background: '#16a34a', color: '#fff', borderRadius: 8,
                                            padding: '6px 14px', fontSize: 12, fontWeight: 600,
                                            textDecoration: 'none',
                                        }}>
                                        <FaGithub size={12} /> View PR #{fixResult.prNumber}
                                        <FaExternalLinkAlt size={9} style={{ opacity: 0.7 }} />
                                    </a>
                                )}
                                {fixResult.commitUrl && (
                                    <a href={fixResult.commitUrl} target="_blank" rel="noreferrer"
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            background: 'rgba(22,163,74,0.12)', color: '#15803d',
                                            border: '1px solid rgba(22,163,74,0.30)',
                                            borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                                            textDecoration: 'none',
                                        }}>
                                        View commit <FaExternalLinkAlt size={9} style={{ opacity: 0.7 }} />
                                    </a>
                                )}
                            </div>

                            {fixResult.prWarning && (
                                <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>
                                    ⚠ {fixResult.prWarning}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Fix failure card ── */}
                {fixResult && !fixResult.success && (
                    <div style={{
                        background: 'rgba(220,38,38,0.07)',
                        border: '1px solid rgba(220,38,38,0.25)',
                        borderRadius: 10,
                        padding: '12px 14px',
                        marginBottom: 16,
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                        <span style={{ fontSize: 16, lineHeight: 1, color: '#ef4444', flexShrink: 0 }}>✕</span>
                        <div style={{ flex: 1, fontSize: 12, color: '#dc2626', lineHeight: 1.6 }}>
                            <strong>Fix failed:</strong> {fixResult.error}
                        </div>
                        <Button variant="link" className="p-0 text-muted" onClick={() => setFixResult(null)} style={{ fontSize: 16, lineHeight: 1 }}>×</Button>
                    </div>
                )}

                {/*
                  * Heuristic: this finding's ai_explanation is stale (was
                  * filled in by the rule-based fallback when no AI provider
                  * was configured). Suggest re-running AI on it.
                  */}
                {!alreadyResolved &&
                    issue.ai_explanation &&
                    /rule library|provider is not configured/i.test(issue.ai_explanation) && (
                        <div
                            className="mb-3 p-2 px-3 d-flex align-items-center gap-2"
                            style={{
                                background: 'rgba(79, 70, 229, 0.06)',
                                border: '1px dashed rgba(79, 70, 229, 0.30)',
                                borderRadius: 8,
                                fontSize: '0.8rem',
                                color: '#4338CA',
                            }}
                        >
                            <FaBrain size={11} />
                            <span className="flex-grow-1">
                                This explanation is from the rule fallback (AI was offline). Refresh
                                it with the live LLM to get an actual code-level fix.
                            </span>
                        </div>
                    )}

                {/* ── Fix step flow ── */}
                {!alreadyResolved && !fixResult?.success && (
                    <div style={{
                        border: '1px solid var(--border-default, #30363D)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        marginTop: 8,
                        marginBottom: 4,
                    }}>
                        {/* Step indicator */}
                        <div style={{
                            display: 'flex',
                            background: 'var(--surface-card-elevated, #1C2333)',
                            borderBottom: '1px solid var(--border-default, #30363D)',
                            padding: '8px 14px',
                            gap: 0,
                        }}>
                            {[
                                { num: 1, label: 'Preview', done: !!preview, active: !preview },
                                { num: 2, label: 'Review diff', done: !!preview && !running, active: !!preview && !running },
                                { num: 3, label: 'Commit & PR', done: false, active: !!preview },
                            ].map((step, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{
                                            width: 22, height: 22, borderRadius: '50%',
                                            background: step.done ? '#6366f1' : step.active ? 'rgba(99,102,241,0.2)' : 'transparent',
                                            border: `2px solid ${step.done || step.active ? '#6366f1' : '#374151'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                            fontSize: 10, fontWeight: 700,
                                            color: step.done ? '#fff' : step.active ? '#818cf8' : '#6b7280',
                                        }}>
                                            {step.done ? <FaCheck size={9} /> : step.num}
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: step.active ? 600 : 400, color: step.active ? 'var(--text-primary, #e6edf3)' : '#6b7280' }}>
                                            {step.label}
                                        </span>
                                    </div>
                                    {idx < 2 && (
                                        <div style={{ flex: 1, height: 1, background: '#374151', margin: '0 8px' }} />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Action area */}
                        <div style={{ padding: '12px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {!preview ? (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={loadPreview}
                                    disabled={!canRunFix || previewing || enhancing}
                                    title={
                                        alreadyResolved
                                            ? 'Already resolved'
                                            : !hasFixCode
                                                ? 'No automatic code fix available for this finding — see the recommendation above, or click Enhance with AI to try generating one.'
                                                : 'Generate diff preview before committing'
                                    }
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    {previewing ? (
                                        <><Spinner size="sm" animation="border" className="me-1" />Generating preview…</>
                                    ) : (
                                        <><FaEye size={12} /> Preview Fix</>
                                    )}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="success"
                                        size="sm"
                                        onClick={runFix}
                                        disabled={running}
                                        title="Push branch + open a PR on GitHub"
                                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                        {running ? (
                                            <><Spinner size="sm" animation="border" className="me-1" />Committing…</>
                                        ) : (
                                            <><FaRocket size={11} /> Commit &amp; Open PR</>
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={cancelPreview}
                                        disabled={running}
                                    >
                                        Discard
                                    </Button>
                                </>
                            )}

                            {/* Enhance with AI — always available */}
                            {issueId && !running && (
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={enhanceWithAI}
                                    disabled={enhancing || previewing}
                                    title="Re-run LLM on this finding to get a real code-level fix"
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
                                >
                                    {enhancing ? (
                                        <><Spinner size="sm" animation="border" className="me-1" />Enhancing…</>
                                    ) : (
                                        <><FaBrain size={11} /> Enhance with AI</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Bottom bar ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <Button variant="outline-secondary" size="sm" onClick={onHide} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <FaTimes size={11} /> Close
                    </Button>
                    {alreadyResolved && (
                        <Badge bg="success" style={{ marginLeft: 'auto' }}>Resolved</Badge>
                    )}
                </div>
            </Offcanvas.Body>
        </Offcanvas>
    );
}
