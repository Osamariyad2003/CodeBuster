import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { ghcolors } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Card } from 'react-bootstrap';
import './CodeViewer.css';

const CodeViewer = ({ filePath, fileContent, comments, language }) => {
  const [activeCommentLine, setActiveCommentLine] = useState(null);

  // Enhanced line props for highlighting and hover effects
  const lineProps = (lineNumber) => {
    const comment = Array.isArray(comments) && comments.find(c => c.line === lineNumber);
    const hasComment = !!comment;
    const isActive = activeCommentLine === lineNumber;

    return {
      className: hasComment ? (isActive ? 'code-line-issue active' : 'code-line-issue') : 'code-line-normal',
      style: {
        display: 'block',
        paddingLeft: '0.5rem',
        cursor: hasComment ? 'pointer' : 'default',
      },
      onClick: () => {
        if (hasComment) {
          setActiveCommentLine(isActive ? null : lineNumber);
        }
      },
      onMouseEnter: (e) => {
        if (!hasComment && !document.documentElement.classList.contains('dark')) {
          e.currentTarget.style.backgroundColor = '#F3F4F6';
        } else if (!hasComment) {
          e.currentTarget.style.backgroundColor = '#21262D';
        }
      },
      onMouseLeave: (e) => {
        if (!hasComment) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }
    };
  };

  // Find active comment to display tooltip
  const activeComment = Array.isArray(comments) && comments.find(c => c.line === activeCommentLine);

  return (
    <Card className="code-viewer-card" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--border-radius)', background: 'var(--surface-card)', overflow: 'hidden', position: 'relative' }}>
      <Card.Header style={{ background: 'var(--background-secondary)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', padding: '12px 16px', fontFamily: 'var(--font-main)' }}>
        {filePath}
      </Card.Header>
      <Card.Body className="p-0 position-relative">
        <SyntaxHighlighter
          language={language || 'javascript'}
          style={ghcolors}
          showLineNumbers
          wrapLines
          lineProps={lineProps}
          customStyle={{ margin: 0, padding: '1rem', fontSize: '0.85rem', background: 'var(--surface-card)' }}
        >
          {fileContent || ''}
        </SyntaxHighlighter>

        {activeComment && (
          <div className="ai-explanation-tooltip">
            <div className="tooltip-header">
              <span className="tooltip-title">AI Insight</span>
              <button className="close-btn" onClick={() => setActiveCommentLine(null)}>×</button>
            </div>
            <div className="tooltip-body">
              <p>{activeComment.message || activeComment.body || activeComment.description || activeComment.title || 'Issue detected on this line.'}</p>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default CodeViewer;

