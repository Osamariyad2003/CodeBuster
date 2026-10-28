import React, { useState } from 'react';
import { Badge } from 'react-bootstrap';
import { FaCopy, FaCheck, FaCode, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * Modern, theme-independent Code Snippet Block.
 * Ensures 100% legibility in both Light Mode and Dark Mode with
 * VS Code Dark Plus styling, copy-to-clipboard, diff line coloring,
 * and issue marker highlighting.
 */
export const CodeSnippetBlock = ({
  code,
  language = 'python',
  title = '',
  filePath = '',
  line = null,
  badge = '',
  badgeVariant = 'primary',
  maxHeight = 400,
  copyable = true,
  className = '',
  style = {},
}) => {
  const [copied, setCopied] = useState(false);

  if (!code || typeof code !== 'string' || !code.trim()) {
    return null;
  }

  const cleanCode = code.trim();

  // Detect if code is a diff/patch
  const isDiff = language === 'diff' ||
    cleanCode.startsWith('diff --git') ||
    cleanCode.startsWith('@@') ||
    cleanCode.startsWith('---') ||
    cleanCode.split('\n').some(l => /^[+-][^+-]/.test(l));

  // Detect if snippet has line numbers or issue markers (e.g. "31 | ... <-- ISSUE")
  const hasLineMarkers = cleanCode.split('\n').some(l => l.includes('<-- ISSUE') || /^\s*\d+\s*\|\s*-->/.test(l));

  // Guess language from file path if language is default
  let detectedLang = language;
  if (filePath && language === 'python') {
    const ext = filePath.split('.').pop().toLowerCase();
    const map = {
      py: 'python',
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      json: 'json',
      yml: 'yaml',
      yaml: 'yaml',
      sh: 'bash',
      sql: 'sql',
      html: 'html',
      css: 'css',
      go: 'go',
      rs: 'rust',
      java: 'java',
      rb: 'ruby',
    };
    if (map[ext]) detectedLang = map[ext];
  }
  if (isDiff) detectedLang = 'diff';

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      // Remove issue markers when copying raw code
      const copyText = cleanCode
        .replace(/<-- ISSUE/g, '')
        .replace(/(\|\s*)-->\s?/g, '$1');
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code snippet:', err);
    }
  };

  return (
    <div
      className={`cb-code-snippet-block ${className}`}
      style={{
        background: '#0B0F19',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
        margin: '10px 0',
        ...style,
      }}
    >
      {/* Header bar */}
      <div
        className="d-flex align-items-center justify-content-between"
        style={{
          background: '#13192B',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '8px 14px',
          fontSize: '0.75rem',
        }}
      >
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Terminal Dots */}
          <div className="d-flex align-items-center gap-1.5 me-1">
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
          </div>

          {badge && (
            <span
              className="badge"
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                background: badgeVariant === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                color: badgeVariant === 'success' ? '#34D399' : '#A5B4FC',
                border: badgeVariant === 'success' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: '5px',
                padding: '3px 7px',
              }}
            >
              {badge.toUpperCase()}
            </span>
          )}

          {title && (
            <span style={{ fontWeight: 600, color: '#E2E8F0', fontSize: '0.8rem' }}>
              {title}
            </span>
          )}

          {filePath && (
            <span
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                color: '#94A3B8',
                fontSize: '0.74rem',
              }}
            >
              {filePath}{line ? `:${line}` : ''}
            </span>
          )}
        </div>

        <div className="d-flex align-items-center gap-2">
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: '0.68rem',
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {detectedLang}
          </span>

          {copyable && (
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-sm"
              style={{
                background: copied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                border: copied ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                color: copied ? '#34D399' : '#CBD5E1',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.72rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                lineHeight: 1.2,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Copy snippet"
            >
              {copied ? <FaCheck size={10} /> : <FaCopy size={10} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Code Area */}
      <div
        style={{
          maxHeight: `${maxHeight}px`,
          overflowY: 'auto',
          overflowX: 'auto',
          padding: isDiff || hasLineMarkers ? '6px 0' : '0',
          background: '#0B0F19',
        }}
      >
        {isDiff ? (
          // Diff line-by-line renderer
          <div
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace)",
              fontSize: '0.8rem',
              lineHeight: 1.6,
            }}
          >
            {cleanCode.split('\n').map((lineText, idx) => {
              const isAdd = lineText.startsWith('+') && !lineText.startsWith('+++');
              const isDel = lineText.startsWith('-') && !lineText.startsWith('---');
              const isHunk = lineText.startsWith('@@');
              const isHeader = lineText.startsWith('---') || lineText.startsWith('+++') || lineText.startsWith('diff ');

              let lineBg = 'transparent';
              let lineColor = '#CBD5E1';
              let borderLeft = '3px solid transparent';

              if (isAdd) {
                lineBg = 'rgba(34, 197, 94, 0.14)';
                lineColor = '#4ADE80';
                borderLeft = '3px solid #22C55E';
              } else if (isDel) {
                lineBg = 'rgba(239, 68, 68, 0.14)';
                lineColor = '#F87171';
                borderLeft = '3px solid #EF4444';
              } else if (isHunk) {
                lineBg = 'rgba(56, 189, 248, 0.08)';
                lineColor = '#38BDF8';
                borderLeft = '3px solid #0EA5E9';
              } else if (isHeader) {
                lineColor = '#94A3B8';
                lineBg = 'rgba(255, 255, 255, 0.03)';
              }

              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: lineBg,
                    color: lineColor,
                    borderLeft,
                    padding: '1px 12px',
                    whiteSpace: 'pre',
                  }}
                >
                  {lineText || ' '}
                </div>
              );
            })}
          </div>
        ) : hasLineMarkers ? (
          // Annotated code context renderer with <-- ISSUE markers
          <div
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace)",
              fontSize: '0.8rem',
              lineHeight: 1.6,
            }}
          >
            {cleanCode.split('\n').map((lineText, idx) => {
              const hasAiMarker = lineText.includes('<-- ISSUE');
              const hasOrchMarker = /^\s*\d+\s*\|\s*-->/.test(lineText);
              const isIssueLine = hasAiMarker || hasOrchMarker;
              const cleanLine = lineText
                .replace('<-- ISSUE', '')
                .replace(/(\|\s*)-->\s?/, '$1');

              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: isIssueLine ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
                    borderLeft: isIssueLine ? '3px solid #EF4444' : '3px solid transparent',
                    color: isIssueLine ? '#FCA5A5' : '#CBD5E1',
                    padding: '2px 12px',
                    whiteSpace: 'pre',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{cleanLine || ' '}</span>
                  {isIssueLine && (
                    <span
                      className="badge bg-danger ms-2"
                      style={{ fontSize: '0.62rem', padding: '2px 6px', flexShrink: 0 }}
                    >
                      DETECTED ISSUE
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Standard syntax-highlighted code
          <SyntaxHighlighter
            language={detectedLang}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '12px 14px',
              background: '#0B0F19',
              fontSize: '0.81rem',
              lineHeight: 1.6,
              fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace)",
            }}
            wrapLines={false}
            showLineNumbers={cleanCode.split('\n').length > 3}
            lineNumberStyle={{
              color: '#475569',
              minWidth: '2.2em',
              paddingRight: '1em',
              fontSize: '0.75rem',
            }}
          >
            {cleanCode}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
};

export default CodeSnippetBlock;
