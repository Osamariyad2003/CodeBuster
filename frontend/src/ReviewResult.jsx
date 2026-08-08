import React, { useState } from 'react';
import { Card, Badge, Button, Collapse, Alert } from 'react-bootstrap';
import { FaCheckCircle, FaExclamationTriangle, FaExclamationCircle, FaInfoCircle, FaChevronDown, FaChevronRight, FaCheck, FaTimes, FaUndo, FaFile, FaShieldAlt, FaBug, FaCode, FaPaintBrush, FaLightbulb } from 'react-icons/fa';
import { apiClient } from './lib/apiClient';
import './ReviewResult.css';

const getCategoryIcon = (category) => {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('security')) return <FaShieldAlt />;
  if (cat.includes('quality') || cat.includes('bug') || cat.includes('correctness')) return <FaBug />;
  if (cat.includes('performance')) return <FaLightbulb />;
  if (cat.includes('maintainability')) return <FaPaintBrush />;
  if (cat.includes('devops') || cat.includes('iac')) return <FaShieldAlt />;
  if (cat.includes('frontend')) return <FaInfoCircle />;
  return <FaCode />;
};

const getCategoryColor = (category) => {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('security')) return { bg: 'rgba(220, 38, 38, 0.05)', color: 'var(--color-danger)', border: 'rgba(220, 38, 38, 0.1)' };
  if (cat.includes('quality') || cat.includes('correctness')) return { bg: 'rgba(79, 70, 229, 0.05)', color: 'var(--primary-brand)', border: 'rgba(79, 70, 229, 0.1)' };
  if (cat.includes('performance')) return { bg: 'rgba(217, 119, 6, 0.05)', color: 'var(--color-warning)', border: 'rgba(217, 119, 6, 0.1)' };
  if (cat.includes('maintainability')) return { bg: 'rgba(16, 185, 129, 0.05)', color: 'var(--color-success)', border: 'rgba(16, 185, 129, 0.1)' };
  if (cat.includes('devops')) return { bg: 'rgba(79, 70, 229, 0.08)', color: 'var(--secondary-accent)', border: 'rgba(79, 70, 229, 0.1)' };
  return { bg: 'rgba(107, 114, 128, 0.05)', color: 'var(--text-muted)', border: 'rgba(107, 114, 128, 0.1)' };
};

const SeverityIcon = ({ severity }) => {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return <FaExclamationCircle style={{ color: 'var(--color-danger)', fontSize: '1.2rem' }} title="Critical Risk" />;
    case 'major':
      return <FaExclamationTriangle style={{ color: 'var(--color-warning)' }} title="Major Issue" />;
    case 'minor':
      return <FaInfoCircle style={{ color: 'var(--secondary-accent)' }} title="Minor Improvement" />;
    case 'info':
      return <FaCheckCircle style={{ color: 'var(--color-success)', opacity: 0.7 }} title="Informational" />;
    default:
      return <FaCheckCircle style={{ color: 'var(--color-success)' }} />;
  }
};

const QualityScoreGauge = ({ score }) => {
  const getScoreColor = (s) => (s >= 80 ? 'var(--color-success)' : s >= 60 ? 'var(--color-warning)' : 'var(--color-danger)');
  const getScoreLabel = (s) => (s >= 90 ? 'Excellent' : s >= 80 ? 'Good' : s >= 60 ? 'Fair' : 'Critical Issues');

  return (
    <div className="quality-score-gauge text-center">
      <div className="score-circle mx-auto mb-2" style={{
        width: 90, height: 90, borderRadius: '50%',
        border: `5px solid ${getScoreColor(score)}20`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface-card)', position: 'relative', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
      }}>
        <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{score}</span>
        <small className="text-muted" style={{ fontSize: '0.65rem', fontWeight: 600 }}>SCORE</small>
      </div>
      <Badge style={{
        background: getScoreColor(score) + '15', color: getScoreColor(score),
        padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '20px'
      }}>
        {getScoreLabel(score)}
      </Badge>
    </div>
  );
};

const getToolBadgeColor = (tool) => {
  const t = tool?.toLowerCase() || '';
  if (t.includes('codeql')) return { bg: '#24292e', color: '#fff' };
  if (t.includes('semgrep')) return { bg: '#3b5bdb', color: '#fff' };
  if (t.includes('trufflehog')) return { bg: '#d97706', color: '#fff' };
  if (t.includes('eslint') || t.includes('pylint')) return { bg: '#4b5563', color: '#fff' };
  return { bg: '#e5e7eb', color: '#374151' };
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
      // 'reset' undoes prior feedback rather than recording a new state.
      setFeedback(action === 'reset' ? null : action);
    } catch (e) { console.error('Feedback failed:', e); }
  };

  const handleApplyFix = async () => {
    if (!comment.suggested_fix) return;
    setApplyingFix(true);
    try {
      const res = await apiClient.post(`/github/fix/apply`, { issue_id: comment.id, review_id: reviewId });
      if (res.success) setFixApplied(true);
    } catch (e) { alert('Failed to apply fix automatically.'); }
    finally { setApplyingFix(false); }
  };

  const isDismissed = feedback === 'dismiss';
  const evidenceCount = (comment.evidence?.analyzer_finding_ids?.length || 0) + (comment.evidence?.rag_snippet_ids?.length || 0);

  return (
    <div className={`review-comment mb-3 ${isDismissed ? 'opacity-50' : ''}`} style={{
      background: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)',
      borderLeft: `4px solid ${isDismissed ? 'var(--text-muted)' : categoryStyle.color}`, overflow: 'hidden', transition: 'var(--transition)'
    }}>
      <div className="p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <SeverityIcon severity={comment.severity} />
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{comment.file}:{comment.line || '??'}</span>

            {/* Category Badge */}
            <Badge style={{ background: categoryStyle.bg, color: categoryStyle.color, border: `1px solid ${categoryStyle.border}`, fontSize: '0.65rem' }}>
              {(comment.category || comment.module || 'CODE').toUpperCase()}
            </Badge>

            {/* Tool Badge */}
            {comment.tool && (
              <Badge style={{ background: toolStyle.bg, color: toolStyle.color, fontSize: '0.6rem', border: '1px solid rgba(0,0,0,0.1)' }}>
                {(comment.tool).toUpperCase()}
              </Badge>
            )}

            {evidenceCount > 0 && (
              <Badge bg="light" text="dark" style={{ fontSize: '0.6rem', border: '1px solid #eee' }}>
                {evidenceCount} Evidence Refs
              </Badge>
            )}
          </div>
          <div className="d-flex gap-2">
            {!feedback ? (
              <>
                <Button variant="link" size="sm" className="p-0 text-success" onClick={() => handleFeedback('accept')}><FaCheck /></Button>
                <Button variant="link" size="sm" className="p-0 text-muted" onClick={() => handleFeedback('dismiss')}><FaTimes /></Button>
              </>
            ) : <Button variant="link" size="sm" className="p-0 text-muted" onClick={() => handleFeedback('reset')}><FaUndo /></Button>}
          </div>
        </div>

        <h6 style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{comment.title}</h6>
        <p className="mb-2" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{comment.description}</p>

        {comment.inline_comment && !isDismissed && (
          <div className="mb-3 p-2 border-start" style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--primary-brand)', background: 'rgba(79, 70, 229, 0.02)' }}>
            <strong>CodeBuster:</strong> "{comment.inline_comment}"
          </div>
        )}

        {(comment.suggested_fix || (comment.suggested_fix && comment.suggested_fix.content)) && !isDismissed && (
          <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px' }}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <Badge bg="dark" style={{ fontSize: '0.6rem' }}>{comment.suggested_fix.type?.toUpperCase() || 'FIX'}</Badge>
            </div>
            <pre style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#e2e8f0', background: '#0f172a', padding: '10px', borderRadius: '6px', overflowX: 'auto' }}>
              <code>{comment.suggested_fix.content || (typeof comment.suggested_fix === 'string' ? comment.suggested_fix : '')}</code>
            </pre>
            <Button variant="primary" size="sm" disabled={applyingFix || fixApplied} onClick={handleApplyFix} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              {applyingFix ? 'Applying...' : fixApplied ? 'Applied' : 'Apply Patch'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const InsightSection = ({ title, items, icon, color }) => {
  if (!items || items.length === 0) return null;
  // Parse if string
  let parsedItems = items;
  if (typeof items === 'string') {
    try { parsedItems = JSON.parse(items); } catch (e) { parsedItems = []; }
  }

  return (
    <div className="mb-4">
      <div className="d-flex align-items-center gap-2 mb-2">
        {icon}
        <h6 style={{ margin: 0, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color }}>{title}</h6>
      </div>
      <div className="d-flex flex-wrap gap-2">
        {parsedItems.map((it, idx) => (
          <Badge key={idx} style={{ background: `${color}10`, color, border: `1px solid ${color}20`, fontWeight: 600, fontSize: '0.75rem' }}>
            {it}
          </Badge>
        ))}
      </div>
    </div>
  );
};

const ReviewResult = ({ review }) => {
  const [expandedFiles, setExpandedFiles] = useState({});
  if (!review) return null;

  const toggleFile = (f) => setExpandedFiles(prev => ({ ...prev, [f]: !prev[f] }));

  // Ensure parsing
  const topRisks = typeof review.top_risks === 'string' ? JSON.parse(review.top_risks || '[]') : (review.top_risks || []);
  const quickWins = typeof review.quick_wins === 'string' ? JSON.parse(review.quick_wins || '[]') : (review.quick_wins || []);
  const extraMetadata = typeof review.extra_metadata === 'string' ? JSON.parse(review.extra_metadata || '{}') : (review.extra_metadata || (review.analysis_metadata || {}));

  const analyzersRun = extraMetadata.analyzers_run || [];
  const filesAnalyzed = extraMetadata.files_analyzed || 0;

  const issues = review.prioritized_issues || [];
  const files = {};
  issues.forEach(issue => {
    const path = issue.file || 'General';
    if (!files[path]) files[path] = { comments: [] };
    files[path].comments.push(issue);
  });

  return (
    <Card style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
      <Card.Body className="p-4">
        <div className="d-flex justify-content-between align-items-start mb-4">
          <div>
            <Badge bg="primary" className="mb-2" style={{ fontSize: '0.6rem' }}>PIPELINE COMPLETE</Badge>
            <h3 style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Review Analysis</h3>
            <div className="text-muted d-flex align-items-center flex-wrap gap-2" style={{ fontSize: '0.8rem' }}>
              <span>AI Reasoner: <code>gpt-4-turbo</code></span>
              <span>|</span>
              <span>Files: {filesAnalyzed}</span>
              <span>|</span>
              <span>Analyzers:</span>

              {analyzersRun.length > 0 ? (
                analyzersRun.map(tool => (
                  <Badge key={tool} bg="light" text="dark" style={{ border: '1px solid #e0e0e0', fontSize: '0.65rem' }}>{tool}</Badge>
                ))
              ) : (
                <span className="text-muted fst-italic">Standard Suite</span>
              )}
            </div>
          </div>
          <QualityScoreGauge score={review.overall_health_score || 0} />
        </div>

        <div className="row mb-4">
          <div className="col-md-6">
            <InsightSection title="Top Risks" items={topRisks} color="var(--color-danger)" icon={<FaExclamationCircle color="var(--color-danger)" />} />
          </div>
          <div className="col-md-6">
            <InsightSection title="Quick Wins" items={quickWins} color="var(--color-success)" icon={<FaCheckCircle color="var(--color-success)" />} />
          </div>
        </div>

        <div className="category-grid d-flex gap-2 mb-5 overflow-auto pb-2">
          {Object.entries(review.category_scores || {}).map(([cat, score]) => (
            <Card key={cat} style={{ flex: '1 0 120px', padding: '12px', textAlign: 'center', background: '#f8fafc', border: '1px solid #eee' }}>
              <div style={{ color: getCategoryColor(cat).color, marginBottom: '4px' }}>{getCategoryIcon(cat)}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{cat.replace('_', ' ')}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{score}</div>
            </Card>
          ))}
        </div>

        <div className="file-list">
          {Object.entries(files).map(([path, data]) => (
            <div key={path} className="mb-3">
              <Button variant="link" className="w-100 text-start p-2 d-flex justify-content-between align-items-center text-decoration-none" onClick={() => toggleFile(path)} style={{ background: '#f1f5f9', borderRadius: '8px', color: 'var(--text-primary)' }}>
                <div className="d-flex align-items-center gap-2">
                  <FaFile size={12} className="text-muted" />
                  <code style={{ fontSize: '0.85rem', fontWeight: 700 }}>{path}</code>
                  <Badge pill bg="dark" style={{ fontSize: '0.6rem' }}>{data.comments.length}</Badge>
                </div>
                {expandedFiles[path] ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
              </Button>
              <Collapse in={expandedFiles[path]}>
                <div className="pt-3 ps-2">
                  {data.comments.map((comment, idx) => (
                    <ReviewComment key={comment.id || idx} comment={comment} reviewId={review.id} />
                  ))}
                </div>
              </Collapse>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
};

export default ReviewResult;
