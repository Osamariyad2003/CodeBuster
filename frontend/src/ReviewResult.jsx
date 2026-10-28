import React, { useState, useMemo } from 'react';
import { Card, Badge, Button, Collapse, Alert } from 'react-bootstrap';
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaExclamationCircle,
  FaInfoCircle,
  FaChevronDown,
  FaChevronRight,
  FaCheck,
  FaTimes,
  FaUndo,
  FaFile,
  FaShieldAlt,
  FaBug,
  FaCode,
  FaPaintBrush,
  FaLightbulb,
} from 'react-icons/fa';
import { apiClient } from './lib/apiClient';
import CodeSnippetBlock from './components/CodeSnippetBlock';
import './ReviewResult.css';

const FormattedDescription = ({ text }) => {
  if (!text) return null;
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\n\n)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', val: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push({ type: 'bold', val: token.slice(2, -2) });
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push({ type: 'code', val: token.slice(1, -1) });
    } else if (token === '\n\n') {
      parts.push({ type: 'break' });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', val: text.slice(lastIndex) });
  }

  return (
    <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
      {parts.map((p, i) => {
        if (p.type === 'bold') {
          return (
            <strong
              key={i}
              style={{
                color: 'var(--text-primary)',
                fontWeight: 700,
                display: p.val.endsWith(':') ? 'inline-block' : 'inline',
                marginTop: p.val.endsWith(':') ? '4px' : '0',
                marginRight: '4px',
              }}
            >
              {p.val}
            </strong>
          );
        }
        if (p.type === 'code') {
          return (
            <code
              key={i}
              style={{
                background: 'var(--surface-card-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--primary-brand, #FF570A)',
                padding: '1px 5px',
                borderRadius: '4px',
                fontSize: '0.82em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {p.val}
            </code>
          );
        }
        if (p.type === 'break') {
          return <div key={i} style={{ height: 6 }} />;
        }
        return <span key={i}>{p.val}</span>;
      })}
    </div>
  );
};

const getCategoryIcon = (category) => {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('security')) return <FaShieldAlt />;
  if (cat.includes('quality') || cat.includes('bug') || cat.includes('correctness')) return <FaBug />;
  if (cat.includes('performance')) return <FaLightbulb />;
  if (cat.includes('maintainability')) return <FaPaintBrush />;
  if (cat.includes('devops') || cat.includes('iac')) return <FaShieldAlt />;
  if (cat.includes('frontend')) return <FaInfoCircle />;
  return <FaCode />;
};

const getCategoryColor = (category) => {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('security')) return { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-danger, #EF4444)', border: 'rgba(239, 68, 68, 0.25)' };
  if (cat.includes('quality') || cat.includes('correctness')) return { bg: 'rgba(255, 87, 10, 0.12)', color: 'var(--primary-brand, #FF570A)', border: 'rgba(255, 87, 10, 0.25)' };
  if (cat.includes('performance')) return { bg: 'rgba(245, 158, 11, 0.12)', color: 'var(--color-warning, #F59E0B)', border: 'rgba(245, 158, 11, 0.25)' };
  if (cat.includes('maintainability')) return { bg: 'rgba(16, 185, 129, 0.12)', color: 'var(--color-success, #25E2A8)', border: 'rgba(16, 185, 129, 0.25)' };
  if (cat.includes('devops')) return { bg: 'rgba(14, 165, 233, 0.12)', color: 'var(--secondary-accent, #0EA5E9)', border: 'rgba(14, 165, 233, 0.25)' };
  return { bg: 'rgba(100, 116, 139, 0.12)', color: 'var(--text-muted, #64748B)', border: 'rgba(100, 116, 139, 0.25)' };
};

const SeverityIcon = ({ severity }) => {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
      return <FaExclamationCircle style={{ color: 'var(--color-danger, #EF4444)', fontSize: '1.15rem' }} title="Critical Risk" />;
    case 'major':
      return <FaExclamationTriangle style={{ color: 'var(--color-warning, #F59E0B)' }} title="Major Issue" />;
    case 'minor':
      return <FaInfoCircle style={{ color: 'var(--secondary-accent, #0EA5E9)' }} title="Minor Improvement" />;
    case 'info':
      return <FaCheckCircle style={{ color: 'var(--color-success, #25E2A8)', opacity: 0.8 }} title="Informational" />;
    default:
      return <FaCheckCircle style={{ color: 'var(--color-success, #25E2A8)' }} />;
  }
};

const QualityScoreGauge = ({ score = 0 }) => {
  const getScoreColor = (s) => (s >= 80 ? 'var(--color-success, #10B981)' : s >= 60 ? 'var(--color-warning, #F59E0B)' : 'var(--color-danger, #EF4444)');
  const getScoreLabel = (s) => (s >= 90 ? 'Excellent' : s >= 80 ? 'Good' : s >= 60 ? 'Fair' : 'Critical Issues');

  return (
    <div className="quality-score-gauge text-center">
      <div
        className="score-circle mx-auto mb-2"
        style={{
          width: 90,
          height: 90,
          borderRadius: '50%',
          border: `5px solid ${getScoreColor(score)}33`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-card)',
          position: 'relative',
          boxShadow: `0 0 20px ${getScoreColor(score)}22`,
        }}
      >
        <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{score}</span>
        <small style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 2 }}>SCORE</small>
      </div>
      <span
        className="badge rounded-pill"
        style={{
          background: getScoreColor(score) + '18',
          color: getScoreColor(score),
          border: `1px solid ${getScoreColor(score)}40`,
          padding: '5px 12px',
          fontSize: '0.72rem',
          fontWeight: 700,
        }}
      >
        {getScoreLabel(score)}
      </span>
    </div>
  );
};

const getToolBadgeColor = (tool) => {
  const t = String(tool || '').toLowerCase();
  if (t.includes('codeql')) return { bg: '#24292e', color: '#fff' };
  if (t.includes('semgrep')) return { bg: '#3b5bdb', color: '#fff' };
  if (t.includes('trufflehog')) return { bg: '#d97706', color: '#fff' };
  if (t.includes('eslint') || t.includes('pylint')) return { bg: '#4b5563', color: '#fff' };
  return { bg: 'var(--surface-card-elevated)', color: 'var(--text-secondary)' };
};

const ReviewComment = ({ comment, reviewId }) => {
  const [feedback, setFeedback] = useState(comment.status || null);
  const [applyingFix, setApplyingFix] = useState(false);
  const [fixApplied, setFixApplied] = useState(false);
  const categoryStyle = getCategoryColor(comment.category || comment.module);
  const toolStyle = getToolBadgeColor(comment.tool);

  const handleFeedback = async (action) => {
    try {
      await apiClient.post(`/api/feedback`, { action, review_id: reviewId, issue_id: comment.id });
      setFeedback(action === 'reset' ? null : action);
    } catch (e) {
      console.error('Feedback failed:', e);
    }
  };

  const handleApplyFix = async () => {
    if (!comment.suggested_fix) return;
    setApplyingFix(true);
    try {
      const res = await apiClient.post(`/github/fix/apply`, { issue_id: comment.id, review_id: reviewId });
      if (res.success) setFixApplied(true);
    } catch (e) {
      alert('Failed to apply fix automatically.');
    } finally {
      setApplyingFix(false);
    }
  };

  const isDismissed = feedback === 'dismiss';
  const evidenceCount = (comment.evidence?.analyzer_finding_ids?.length || 0) + (comment.evidence?.rag_snippet_ids?.length || 0);

  const filePath = comment.file || comment.file_path || '';
  const lineNumber = comment.line || comment.line_number || comment.start_line || null;
  const rawSnippet = comment.code_snippet;
  const codeSnippet = typeof rawSnippet === 'string' && rawSnippet.trim().length > 0 ? rawSnippet.trim() : null;

  // Extract non-empty fix data
  const fixData = useMemo(() => {
    const raw = comment.suggested_fix;
    if (!raw) return null;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      return trimmed ? { content: trimmed, type: 'PATCH', explanation: null } : null;
    }
    if (typeof raw === 'object' && raw !== null) {
      const code = (raw.code || raw.content || raw.patch || '').trim();
      const expl = (raw.explanation || '').trim();
      if (code && code !== '""' && code !== "''") {
        return {
          content: code,
          type: raw.type || (raw.patch ? 'PATCH' : 'FIX'),
          explanation: expl || null,
        };
      }
      if (raw.diff && typeof raw.diff === 'string' && raw.diff.trim()) {
        return {
          content: raw.diff.trim(),
          type: 'DIFF',
          explanation: expl || null,
        };
      }
      if (expl) {
        return { content: null, type: null, explanation: expl };
      }
    }
    return null;
  }, [comment.suggested_fix]);

  return (
    <div
      className={`review-comment mb-3 ${isDismissed ? 'opacity-50' : ''}`}
      style={{
        background: 'var(--surface-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-default)',
        borderLeft: `4px solid ${isDismissed ? 'var(--text-muted)' : categoryStyle.color}`,
        overflow: 'hidden',
        transition: 'var(--transition)',
      }}
    >
      <div className="p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <SeverityIcon severity={comment.severity} />
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {filePath || 'General'}{lineNumber ? `:${lineNumber}` : ''}
            </span>

            {/* Category Badge */}
            <span
              className="badge"
              style={{
                background: categoryStyle.bg,
                color: categoryStyle.color,
                border: `1px solid ${categoryStyle.border}`,
                fontSize: '0.65rem',
              }}
            >
              {String(comment.category || comment.module || 'CODE').toUpperCase()}
            </span>

            {/* Tool Badge */}
            {comment.tool && (
              <span
                className="badge"
                style={{
                  background: toolStyle.bg,
                  color: toolStyle.color,
                  fontSize: '0.62rem',
                  border: '1px solid var(--border-default)',
                }}
              >
                {String(comment.tool).toUpperCase()}
              </span>
            )}

            {evidenceCount > 0 && (
              <Badge bg="secondary" className="border border-secondary-subtle" style={{ fontSize: '0.6rem' }}>
                {evidenceCount} Evidence Refs
              </Badge>
            )}
          </div>
          <div className="d-flex gap-2">
            {!feedback ? (
              <>
                <Button variant="link" size="sm" className="p-0 text-success" onClick={() => handleFeedback('accept')} title="Accept finding">
                  <FaCheck />
                </Button>
                <Button variant="link" size="sm" className="p-0 text-muted" onClick={() => handleFeedback('dismiss')} title="Dismiss finding">
                  <FaTimes />
                </Button>
              </>
            ) : (
              <Button variant="link" size="sm" className="p-0 text-muted" onClick={() => handleFeedback('reset')} title="Reset status">
                <FaUndo />
              </Button>
            )}
          </div>
        </div>

        <h6 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '1rem', letterSpacing: '-0.01em' }}>
          {comment.title || comment.message || comment.description || 'Finding'}
        </h6>
        <div className="mb-3">
          <FormattedDescription
            text={comment.description || comment.ai_explanation || comment.message || ''}
          />
        </div>

        {comment.inline_comment && !isDismissed && (
          <div
            className="mb-3 p-2.5 rounded"
            style={{
              fontStyle: 'italic',
              fontSize: '0.82rem',
              color: 'var(--primary-brand-hover, #FF7A30)',
              background: 'rgba(255, 87, 10, 0.08)',
              borderLeft: '3px solid var(--primary-brand, #FF570A)',
            }}
          >
            <strong>CodeBuster:</strong> &ldquo;{comment.inline_comment}&rdquo;
          </div>
        )}

        {/* Code Context from source repo */}
        {codeSnippet && !isDismissed && (
          <div className="mb-3">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                Code Context
              </span>
            </div>
            <CodeSnippetBlock
              code={codeSnippet}
              filePath={filePath}
              line={lineNumber}
              badge="CONTEXT"
              badgeVariant="secondary"
            />
          </div>
        )}

        {/* Suggested Fix Code */}
        {fixData?.content && !isDismissed && (
          <div className="mb-3">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#10B981', letterSpacing: '0.04em' }}>
                Proposed Patch
              </span>
              {fixData.explanation && (
                <span className="small text-muted">{fixData.explanation}</span>
              )}
            </div>
            <CodeSnippetBlock
              code={fixData.content}
              language={fixData.type === 'DIFF' ? 'diff' : 'python'}
              filePath={filePath}
              badge={fixData.type || 'PATCH'}
              badgeVariant="success"
            />
            <div className="d-flex align-items-center gap-2 mt-2">
              <Button
                variant="primary"
                size="sm"
                disabled={applyingFix || fixApplied}
                onClick={handleApplyFix}
                style={{ fontSize: '0.75rem', fontWeight: 600, borderRadius: 6, padding: '5px 14px' }}
              >
                {applyingFix ? 'Applying...' : fixApplied ? 'Patch Applied' : 'Apply Patch'}
              </Button>
              {fixApplied && (
                <span className="small text-success d-flex align-items-center gap-1">
                  <FaCheckCircle size={12} /> Committed to branch
                </span>
              )}
            </div>
          </div>
        )}

        {/* Remediation note when there's an explanation without patch code */}
        {fixData?.explanation && !fixData?.content && !isDismissed && (
          <div
            className="p-2.5 rounded mb-3"
            style={{
              background: 'rgba(99, 102, 241, 0.06)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            <strong className="text-primary me-1">Guidance:</strong> {fixData.explanation}
          </div>
        )}
      </div>
    </div>
  );
};

const InsightSection = ({ title, items, icon, color }) => {
  if (!items) return null;
  let parsedItems = items;
  if (typeof items === 'string') {
    try {
      parsedItems = JSON.parse(items);
    } catch (e) {
      parsedItems = [];
    }
  }
  if (!Array.isArray(parsedItems)) {
    parsedItems = typeof parsedItems === 'object' && parsedItems !== null
      ? Object.values(parsedItems)
      : [parsedItems];
  }
  if (parsedItems.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="d-flex align-items-center gap-2 mb-2">
        {icon}
        <h6
          style={{
            margin: 0,
            fontWeight: 700,
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            letterSpacing: '0.06em',
            color,
          }}
        >
          {title}
        </h6>
      </div>
      <div className="d-flex flex-wrap gap-2">
        {parsedItems.map((it, idx) => {
          const text = typeof it === 'object' && it !== null
            ? (it.title || it.message || it.why_it_matters || JSON.stringify(it))
            : String(it);
          return (
            <span
              key={idx}
              className="badge"
              style={{
                background: `${color}15`,
                color,
                border: `1px solid ${color}30`,
                fontWeight: 600,
                fontSize: '0.75rem',
                padding: '5px 10px',
              }}
            >
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const ReviewResult = ({ review }) => {
  const [expandedFiles, setExpandedFiles] = useState({});
  if (!review) return null;

  const toggleFile = (f) => setExpandedFiles((prev) => ({ ...prev, [f]: !prev[f] }));

  // Ensure parsing
  const topRisks = typeof review.top_risks === 'string'
    ? (() => { try { return JSON.parse(review.top_risks); } catch (_) { return []; } })()
    : (review.top_risks || []);

  const quickWins = typeof review.quick_wins === 'string'
    ? (() => { try { return JSON.parse(review.quick_wins); } catch (_) { return []; } })()
    : (review.quick_wins || []);

  const extraMetadata = typeof review.extra_metadata === 'string'
    ? (() => { try { return JSON.parse(review.extra_metadata); } catch (_) { return {}; } })()
    : (review.extra_metadata || review.analysis_metadata || {});

  const analyzersRun = Array.isArray(extraMetadata?.analyzers_run) ? extraMetadata.analyzers_run : [];
  const filesAnalyzed = extraMetadata?.files_analyzed || 0;

  // Resiliently normalize category_scores into an array of { key, label, score }
  const categoryScoresList = useMemo(() => {
    let raw = review.category_scores;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (_) {
        raw = [];
      }
    }
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          const k = item.key || item.category || String(idx);
          const scoreVal = typeof item.score === 'number' ? item.score : (item.value ?? item.score ?? '—');
          return {
            key: k,
            label: item.label || k.replace(/_/g, ' '),
            score: scoreVal,
          };
        }
        return { key: String(idx), label: `Category ${idx + 1}`, score: String(item) };
      });
    }
    if (typeof raw === 'object') {
      return Object.entries(raw).map(([key, val]) => {
        if (typeof val === 'object' && val !== null) {
          const scoreVal = typeof val.score === 'number' ? val.score : (val.score ?? val.value ?? '—');
          return {
            key,
            label: val.label || key.replace(/_/g, ' '),
            score: scoreVal,
          };
        }
        return {
          key,
          label: key.replace(/_/g, ' '),
          score: val,
        };
      });
    }
    return [];
  }, [review.category_scores]);

  // Support both prioritized_issues, findings, and issues shapes
  const rawIssues = review.prioritized_issues || review.findings || review.issues || [];
  const files = {};
  rawIssues.forEach((issue) => {
    const path = issue.file || issue.file_path || 'General';
    if (!files[path]) files[path] = { comments: [] };
    files[path].comments.push(issue);
  });

  const overallScore = review.overall_health_score ?? review.overall_score ?? 0;

  return (
    <Card
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-default)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <Card.Body className="p-4">
        <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
          <div>
            <Badge bg="primary" className="mb-2" style={{ fontSize: '0.65rem', borderRadius: 6 }}>
              PIPELINE COMPLETE
            </Badge>
            <h3 style={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
              Review Analysis
            </h3>
            <div className="text-muted d-flex align-items-center flex-wrap gap-2 mt-2" style={{ fontSize: '0.8rem' }}>
              <span>AI Reasoner: <code style={{ color: 'var(--jb-purple-light)' }}>gpt-4-turbo</code></span>
              <span>|</span>
              <span>Files: <strong style={{ color: 'var(--text-primary)' }}>{filesAnalyzed}</strong></span>
              <span>|</span>
              <span>Analyzers:</span>

              {analyzersRun.length > 0 ? (
                analyzersRun.map((tool) => (
                  <Badge key={tool} bg="secondary" className="border border-secondary-subtle" style={{ fontSize: '0.65rem' }}>
                    {tool}
                  </Badge>
                ))
              ) : (
                <span className="text-muted fst-italic">Standard Suite</span>
              )}
            </div>
          </div>
          <QualityScoreGauge score={overallScore} />
        </div>

        <div className="row mb-4">
          <div className="col-md-6">
            <InsightSection
              title="Top Risks"
              items={topRisks}
              color="var(--color-danger, #EF4444)"
              icon={<FaExclamationCircle color="var(--color-danger, #EF4444)" />}
            />
          </div>
          <div className="col-md-6">
            <InsightSection
              title="Quick Wins"
              items={quickWins}
              color="var(--color-success, #10B981)"
              icon={<FaCheckCircle color="var(--color-success, #10B981)" />}
            />
          </div>
        </div>

        {/* Category Scores Grid */}
        {categoryScoresList.length > 0 && (
          <div className="category-grid d-flex gap-2 mb-4 overflow-auto pb-2">
            {categoryScoresList.map((c) => (
              <Card
                key={c.key}
                style={{
                  flex: '1 0 120px',
                  padding: '14px',
                  textAlign: 'center',
                  background: 'var(--surface-card-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 12,
                }}
              >
                <div style={{ color: getCategoryColor(c.key).color, marginBottom: '6px', fontSize: '1.15rem' }}>
                  {getCategoryIcon(c.key)}
                </div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  {c.label}
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                  {c.score}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Files and findings */}
        <div className="file-list">
          {Object.entries(files).length === 0 ? (
            <div className="text-center py-4 text-muted small">
              No code issues flagged in this review.
            </div>
          ) : (
            Object.entries(files).map(([path, data]) => (
              <div key={path} className="mb-3">
                <Button
                  variant="link"
                  className="w-100 text-start p-2.5 d-flex justify-content-between align-items-center text-decoration-none"
                  onClick={() => toggleFile(path)}
                  style={{
                    background: 'var(--surface-card-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <FaFile size={13} className="text-muted" />
                    <code style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{path}</code>
                    <Badge pill bg="dark" style={{ fontSize: '0.65rem' }}>
                      {data.comments.length}
                    </Badge>
                  </div>
                  {expandedFiles[path] ? <FaChevronDown size={11} /> : <FaChevronRight size={11} />}
                </Button>
                <Collapse in={expandedFiles[path]}>
                  <div className="pt-3 ps-2">
                    {data.comments.map((comment, idx) => (
                      <ReviewComment key={comment.id || idx} comment={comment} reviewId={review.id} />
                    ))}
                  </div>
                </Collapse>
              </div>
            ))
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default ReviewResult;
