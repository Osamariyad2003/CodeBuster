/**
 * Displays enriched review issue_list with filters (severity, tags, linters_reference).
 * Aligns with EXISTING_UI_COMPONENTS: SeverityBadge, ReviewDetailPage filter pattern, IssueTable-style table.
 */

import React, { useMemo, useState } from "react";
import { Table, Badge, Form, Card, Accordion } from "react-bootstrap";
import SeverityBadge from "../findings/SeverityBadge";
import type { EnrichedReviewResponse, EnrichedIssue } from "../../types/enrichedReview";

export interface EnrichedReviewViewProps {
  data: EnrichedReviewResponse;
  /** Optional: show card view instead of/in addition to table */
  viewMode?: "table" | "cards" | "both";
}

/** Collect unique values for filter dropdowns from issue_list */
function useFilters(issues: EnrichedIssue[]) {
  const severities = useMemo(() => {
    const set = new Set(issues.map((i) => i.severity).filter(Boolean));
    return Array.from(set).sort();
  }, [issues]);
  const tags = useMemo(() => {
    const set = new Set(issues.flatMap((i) => i.tags || []).filter(Boolean));
    return Array.from(set).sort();
  }, [issues]);
  const linterNames = useMemo(() => {
    const set = new Set(
      issues.flatMap((i) => (i.linters_reference || []).map((r) => r.linter_name)).filter(Boolean)
    );
    return Array.from(set).sort();
  }, [issues]);
  return { severities, tags, linterNames };
}

export default function EnrichedReviewView({ data, viewMode = "table" }: EnrichedReviewViewProps) {
  const [severityFilter, setSeverityFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [linterFilter, setLinterFilter] = useState("");
  const { severities, tags, linterNames } = useFilters(data.issue_list);

  const filtered = useMemo(() => {
    return data.issue_list.filter((issue) => {
      if (severityFilter && (issue.severity || "").toLowerCase() !== severityFilter.toLowerCase())
        return false;
      if (tagFilter && !(issue.tags || []).some((t) => t === tagFilter)) return false;
      if (
        linterFilter &&
        !(issue.linters_reference || []).some((r) => r.linter_name === linterFilter)
      )
        return false;
      return true;
    });
  }, [data.issue_list, severityFilter, tagFilter, linterFilter]);

  const filters = (
    <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
      <Form.Select
        size="sm"
        style={{ width: "auto" }}
        value={severityFilter}
        onChange={(e) => setSeverityFilter(e.target.value)}
        aria-label="Filter by severity"
      >
        <option value="">All severities</option>
        {severities.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Form.Select>
      <Form.Select
        size="sm"
        style={{ width: "auto" }}
        value={tagFilter}
        onChange={(e) => setTagFilter(e.target.value)}
        aria-label="Filter by tag"
      >
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Form.Select>
      <Form.Select
        size="sm"
        style={{ width: "auto" }}
        value={linterFilter}
        onChange={(e) => setLinterFilter(e.target.value)}
        aria-label="Filter by linter"
      >
        <option value="">All linters</option>
        {linterNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Form.Select>
    </div>
  );

  return (
    <div className="enriched-review-view">
      <div className="mb-2">
        <Badge bg="secondary" className="me-2">
          {data.project}
        </Badge>
        <span className="text-muted small">{data.scan_source}</span>
      </div>
      {filters}
      {(viewMode === "table" || viewMode === "both") && (
        <Table hover responsive size="sm" className="mb-4">
          <thead className="table-light">
            <tr>
              <th>Severity</th>
              <th>Rule</th>
              <th>File:Line</th>
              <th>Description</th>
              <th>Effort</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((issue) => (
              <tr key={issue.issue_id}>
                <td>
                  <SeverityBadge severity={issue.severity} />
                </td>
                <td className="small">{issue.rule || "—"}</td>
                <td className="small text-nowrap">
                  <code>{issue.file}</code>:{issue.line}
                </td>
                <td className="small" style={{ maxWidth: 320 }}>
                  {issue.description || "—"}
                </td>
                <td>{issue.effort_minutes != null ? `${issue.effort_minutes} min` : "—"}</td>
                <td>
                  {(issue.tags || []).slice(0, 3).map((t) => (
                    <Badge key={t} bg="light" text="dark" className="me-1">
                      {t}
                    </Badge>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {(viewMode === "cards" || viewMode === "both") && (
        <Accordion className="mb-4">
          {filtered.map((issue, idx) => (
            <Accordion.Item key={issue.issue_id} eventKey={String(idx)}>
              <Accordion.Header>
                <span className="me-2"><SeverityBadge severity={issue.severity} /></span>
                <span className="text-truncate me-2">{issue.rule}</span>
                <code className="small text-muted">{issue.file}:{issue.line}</code>
              </Accordion.Header>
              <Accordion.Body>
                <p className="small mb-2">{issue.description}</p>
                {issue.code_snippet && (
                  <div className="mb-2">
                    <strong className="d-block small mb-1">Code Context:</strong>
                    <pre className="p-2 bg-dark text-light rounded small mb-0" style={{ fontSize: '11px', overflow: 'auto' }}>
                      {issue.code_snippet}
                    </pre>
                  </div>
                )}
                {issue.ai_explanation && (
                  <div className="mb-2">
                    <strong className="d-block small mb-1">AI Explanation:</strong>
                    <div className="small text-muted p-2 bg-light rounded border-start border-4 border-info">
                      {issue.ai_explanation}
                    </div>
                  </div>
                )}
                {issue.recommended_fix && (
                  <p className="small mb-2 text-success">
                    <strong>Fix:</strong> {issue.recommended_fix}
                  </p>
                )}
                {issue.suggested_fix && issue.suggested_fix.content && (
                  <div className="mb-2">
                    <strong className="d-block small mb-1 text-success">Suggested Fix:</strong>
                    <pre className="p-2 bg-dark text-success rounded small mb-0" style={{ fontSize: '11px', overflow: 'auto', borderLeft: '3px solid #198754' }}>
                      {issue.suggested_fix.content}
                    </pre>
                  </div>
                )}
                {issue.effort_minutes != null && (
                  <p className="small mb-2">Effort: {issue.effort_minutes} min</p>
                )}
                {(issue.linters_reference || []).length > 0 && (
                  <div className="small">
                    <strong>Linters:</strong>
                    <ul className="mb-0 mt-1">
                      {issue.linters_reference!.map((r, i) => (
                        <li key={i}>
                          {r.linter_name} ({r.linter_rule_id}): {r.linter_rule_desc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(issue.tags || []).length > 0 && (
                  <div className="mt-2">
                    {(issue.tags || []).map((t) => (
                      <Badge key={t} bg="light" text="dark" className="me-1">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
      {filtered.length === 0 && (
        <div className="text-center py-4 text-muted">No issues match the filters.</div>
      )}
    </div>
  );
}
