import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Container,
  Spinner,
  Alert,
  Form,
  Button,
  Badge,
} from "react-bootstrap";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCodeBranch,
  FaCalendarAlt,
  FaFilter,
  FaTimes,
  FaLightbulb,
  FaExclamationTriangle,
  FaCheckCircle,
  FaListOl,
  FaBrain,
  FaRocket,
} from "react-icons/fa";
import { codebusterApi, ReviewDetail as ReviewDetailType, Finding } from "../api/codebuster";
import IssueDetailDrawer from "../components/reviews/IssueDetailDrawer";
import { useAuth } from "../AuthContext";
import { apiClient } from "../lib/apiClient";

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, MAJOR: 1, MINOR: 2, INFO: 3 };
const FIX_SPRINT_SIZE = 5;

const SEVERITY_OPTIONS = ["CRITICAL", "MAJOR", "MINOR", "INFO"] as const;

const gradeColor = (grade?: string | null): string => {
  switch (grade) {
    case "A": return "#059669";
    case "B": return "#4F46E5";
    case "C": return "#F59E0B";
    case "D": return "#EF4444";
    case "F": return "#991B1B";
    default:  return "#9CA3AF";
  }
};

const scoreColor = (score?: number | null): string => {
  if (score == null) return "#9CA3AF";
  if (score >= 85) return "#059669";
  if (score >= 70) return "#4F46E5";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
};

const severityColor = (sev?: string): string => {
  const s = (sev || "").toUpperCase();
  if (s === "CRITICAL") return "#DC2626";
  if (s === "MAJOR") return "#F59E0B";
  if (s === "MINOR") return "#4F46E5";
  if (s === "INFO") return "#0EA5E9";
  return "#6B7280";
};

const formatDate = (iso?: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { connectedRepos = [] } = useAuth() as { connectedRepos: any[] };
  const [searchParams, setSearchParams] = useSearchParams();
  const [review, setReview] = useState<ReviewDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintResult, setSprintResult] = useState<any>(null);
  const [sprintError, setSprintError] = useState<string | null>(null);

  const severity = searchParams.get("severity") ?? "";
  const category = searchParams.get("category") ?? "";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    codebusterApi
      .getReview(id, { severity: severity || undefined, category: category || undefined })
      .then((res) => {
        if (!cancelled) setReview(res);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || "Failed to load review");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, severity, category]);

  const handleFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("severity");
    next.delete("category");
    setSearchParams(next);
  };

  const repoName = useMemo(() => {
    if (!review?.repo_id) return null;
    const found = (connectedRepos || []).find((r: any) => r?.id === review.repo_id);
    return found?.full_name || review.repo_id;
  }, [connectedRepos, review?.repo_id]);

  const findings: Finding[] = review?.findings ?? [];
  const hasFilter = Boolean(severity || category);

  // Fix Sprint targets: unresolved issues, worst severity first, top N —
  // this is deliberately automatic (no manual multi-select) so the whole
  // flow is a single click: pick the worst issues, fix what's fixable,
  // open one PR.
  const sprintTargets = [...findings]
    .filter((f) => (f as any).status !== "resolved")
    .sort((a, b) => (SEVERITY_RANK[(a.severity || "").toUpperCase()] ?? 9) - (SEVERITY_RANK[(b.severity || "").toUpperCase()] ?? 9))
    .slice(0, FIX_SPRINT_SIZE);

  const runFixSprint = async () => {
    if (sprintRunning || sprintTargets.length === 0) return;
    setSprintRunning(true);
    setSprintError(null);
    setSprintResult(null);
    try {
      const res: any = await apiClient.post("/github/fix/sprint", {
        issue_ids: sprintTargets.map((f) => f.id),
      });
      if (res?.success) {
        setSprintResult(res);
      } else {
        setSprintError(res?.error || "Fix Sprint failed");
      }
    } catch (err: any) {
      setSprintError(err?.body?.error || err?.message || "Fix Sprint failed");
    } finally {
      setSprintRunning(false);
    }
  };

  if (loading && !review) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />{" "}
        <span className="text-muted">Loading review…</span>
      </Container>
    );
  }
  if (error && !review) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }
  if (!review) return null;

  const score = review.overall_score ?? null;
  const grade = review.overall_grade ?? null;

  return (
    <Container className="py-4" style={{ maxWidth: 1100 }}>
      {/* Back link */}
      <Link
        to="/reviews"
        className="d-inline-flex align-items-center text-muted text-decoration-none small mb-3"
        style={{ gap: 6 }}
      >
        <FaArrowLeft size={11} /> Back to reviews
      </Link>

      {/* Summary card */}
      <div
        className="p-4 mb-4"
        style={{
          background: "white",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
        }}
      >
        <div className="d-flex align-items-start gap-3 flex-wrap">
          {/* Grade square */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: gradeColor(grade),
              color: "white",
              fontWeight: 700,
              fontSize: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {grade || "—"}
          </div>

          <div className="flex-grow-1" style={{ minWidth: 200 }}>
            <div className="d-flex align-items-baseline gap-2 flex-wrap">
              <h4 className="mb-0 fw-bold" style={{ color: "#111827" }}>
                Review
              </h4>
              <code className="text-muted small">{id?.slice(0, 8)}</code>
            </div>
            <div className="text-muted small mt-1 d-flex align-items-center gap-3 flex-wrap">
              {repoName && (
                <span className="d-inline-flex align-items-center" style={{ gap: 5 }}>
                  <FaCodeBranch size={11} /> {repoName}
                </span>
              )}
              <span className="d-inline-flex align-items-center" style={{ gap: 5 }}>
                <FaCalendarAlt size={11} /> {formatDate(review.created_at)}
              </span>
              {(() => {
                const stats = review.extra_metadata?.ai_stats;
                if (!stats) return null;
                const offline = !stats.provider || stats.attempted === 0;
                const fullCoverage = stats.enhanced === stats.attempted && stats.attempted > 0;
                const color = offline
                  ? "#9CA3AF"
                  : fullCoverage
                  ? "#059669"
                  : stats.failed > 0
                  ? "#F59E0B"
                  : "#4F46E5";
                const label = offline
                  ? "AI offline (rule-based)"
                  : `AI: ${stats.enhanced}/${stats.attempted} enhanced`;
                const cacheHint =
                  stats.cache_hits > 0
                    ? ` · ${stats.cache_hits} cached`
                    : "";
                return (
                  <span
                    title={
                      offline
                        ? "AI provider was unavailable — findings show rule-based explanations only"
                        : `Provider: ${stats.provider}${cacheHint ? ", " + stats.cache_hits + " from cache" : ""}`
                    }
                    className="d-inline-flex align-items-center"
                    style={{
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: color + "15",
                      color,
                      border: `1px solid ${color}30`,
                      fontSize: "0.72rem",
                      fontWeight: 600,
                    }}
                  >
                    <FaLightbulb size={9} />
                    {label}
                    {cacheHint}
                  </span>
                );
              })()}
            </div>

            {/* Score with bar */}
            <div className="mt-3" style={{ maxWidth: 360 }}>
              <div className="d-flex justify-content-between align-items-baseline mb-1">
                <span
                  className="text-muted"
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Overall score
                </span>
                <span
                  className="fw-semibold"
                  style={{ color: scoreColor(score) }}
                >
                  {score != null ? `${score}/100` : "—"}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "#F3F4F6",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                {score != null && (
                  <div
                    style={{
                      width: `${Math.max(2, Math.min(100, score))}%`,
                      height: "100%",
                      background: scoreColor(score),
                      transition: "width 0.3s ease",
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Category scores */}
        {review.category_scores && review.category_scores.length > 0 && (
          <div
            className="mt-4 pt-4"
            style={{ borderTop: "1px solid #F3F4F6" }}
          >
            <div
              className="text-muted mb-3"
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Category Scores
            </div>
            <div className="row g-3">
              {review.category_scores.map((c) => (
                <div key={c.key} className="col-6 col-md-4 col-lg-3">
                  <div
                    className="d-flex justify-content-between align-items-baseline mb-1"
                    style={{ fontSize: "0.85rem" }}
                  >
                    <span style={{ color: "#374151" }}>{c.label}</span>
                    <span
                      className="fw-semibold"
                      style={{ color: scoreColor(c.score), fontSize: "0.8rem" }}
                    >
                      {c.score}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: "#F3F4F6",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(2, Math.min(100, c.score))}%`,
                        height: "100%",
                        background: scoreColor(c.score),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI executive summary (only renders when the worker had AI available) */}
      {(() => {
        const summary = review.extra_metadata?.executive_summary;
        if (!summary || !summary.executive_summary) return null;

        const readiness = summary.production_readiness;
        const readinessColor =
          readiness === "yes"
            ? "#059669"
            : readiness === "with_caveats"
            ? "#F59E0B"
            : readiness === "no"
            ? "#DC2626"
            : "#6B7280";
        const readinessLabel =
          readiness === "yes"
            ? "Production-ready"
            : readiness === "with_caveats"
            ? "Ship with caveats"
            : readiness === "no"
            ? "Not production-ready"
            : null;

        return (
          <div
            className="p-4 mb-4"
            style={{
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
              borderLeft: "3px solid #4F46E5",
            }}
          >
            <div className="d-flex align-items-center mb-3 gap-2">
              <FaLightbulb size={14} style={{ color: "#4F46E5" }} />
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#4F46E5",
                }}
              >
                AI Executive Summary
              </span>
              {readinessLabel && (
                <span
                  className="ms-auto d-inline-flex align-items-center gap-1 px-2 py-1"
                  style={{
                    background: readinessColor + "15",
                    color: readinessColor,
                    border: `1px solid ${readinessColor}40`,
                    borderRadius: 6,
                    fontSize: "0.72rem",
                    fontWeight: 600,
                  }}
                >
                  {readiness === "yes" ? (
                    <FaCheckCircle size={10} />
                  ) : (
                    <FaExclamationTriangle size={10} />
                  )}
                  {readinessLabel}
                </span>
              )}
            </div>

            <p
              className="mb-3"
              style={{
                color: "#111827",
                fontSize: "0.95rem",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {summary.executive_summary}
            </p>

            {summary.production_readiness_rationale && (
              <p
                className="small mb-3"
                style={{ color: "#6B7280", fontStyle: "italic" }}
              >
                {summary.production_readiness_rationale}
              </p>
            )}

            {summary.top_risks_narrative && summary.top_risks_narrative.length > 0 && (
              <div className="mt-3">
                <div
                  className="mb-2"
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "#6B7280",
                  }}
                >
                  Top Risks
                </div>
                <div className="d-flex flex-column gap-2">
                  {summary.top_risks_narrative.map((risk, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 d-flex align-items-start gap-2"
                      style={{
                        background: "#FEF3C7",
                        border: "1px solid #FDE68A",
                        borderRadius: 8,
                      }}
                    >
                      <FaExclamationTriangle
                        size={11}
                        style={{ color: "#D97706", marginTop: 4, flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div
                          className="fw-semibold"
                          style={{ fontSize: "0.85rem", color: "#92400E" }}
                        >
                          {risk.title}
                        </div>
                        <div
                          className="small"
                          style={{ color: "#78350F", lineHeight: 1.45 }}
                        >
                          {risk.why_it_matters}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.fix_priority_order && summary.fix_priority_order.length > 0 && (
              <div className="mt-3">
                <div
                  className="mb-2 d-flex align-items-center gap-2"
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "#6B7280",
                  }}
                >
                  <FaListOl size={11} /> Suggested fix order
                </div>
                <ol className="mb-0 ps-4" style={{ color: "#111827" }}>
                  {summary.fix_priority_order.map((step, i) => {
                    const target = findings[step.issue_index];
                    return (
                      <li
                        key={i}
                        className="mb-1"
                        style={{ fontSize: "0.88rem", lineHeight: 1.5 }}
                      >
                        {target ? (
                          <span className="fw-semibold">
                            {target.message || target.category || "Finding"}
                          </span>
                        ) : (
                          <span className="text-muted">Finding #{step.issue_index}</span>
                        )}
                        <span className="text-muted"> — {step.rationale}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        );
      })()}

      {/* Filter toolbar */}
      <div
        className="d-flex align-items-center gap-2 mb-3 px-3 py-2 flex-wrap"
        style={{
          background: "white",
          border: "1px solid #E5E7EB",
          borderRadius: 10,
        }}
      >
        <FaFilter size={11} className="text-muted" />
        <span className="text-muted small me-2">Filter:</span>

        <Form.Select
          size="sm"
          style={{ width: "auto", maxWidth: 200 }}
          value={severity}
          onChange={(e) => handleFilter("severity", e.target.value)}
        >
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Form.Select>

        <Form.Control
          size="sm"
          style={{ width: 200 }}
          placeholder="Category…"
          value={category}
          onChange={(e) => handleFilter("category", e.target.value)}
        />

        {hasFilter && (
          <Button
            variant="link"
            size="sm"
            className="text-decoration-none ms-auto"
            onClick={clearFilters}
          >
            <FaTimes size={10} className="me-1" /> Clear filters
          </Button>
        )}
      </div>

      {/* Fix Sprint: one click, top N issues, one PR */}
      {sprintTargets.length > 0 && (
        <div
          className="d-flex align-items-center justify-content-between flex-wrap gap-2 p-3 mb-3"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06))",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 12,
          }}
        >
          <div>
            <div className="fw-bold d-flex align-items-center gap-2" style={{ color: "#111827", fontSize: "0.92rem" }}>
              <FaRocket size={13} style={{ color: "#6366F1" }} /> Fix Sprint
            </div>
            <div className="text-muted small mt-1">
              AI fixes the top {sprintTargets.length} unresolved issue{sprintTargets.length === 1 ? "" : "s"} and opens one pull request.
            </div>
          </div>
          <Button
            onClick={runFixSprint}
            disabled={sprintRunning}
            style={{
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              border: "none", fontWeight: 700, borderRadius: 9, padding: "8px 18px",
            }}
          >
            {sprintRunning ? (
              <><Spinner animation="border" size="sm" className="me-2" />Fixing…</>
            ) : (
              <>Run Fix Sprint ({sprintTargets.length})</>
            )}
          </Button>
        </div>
      )}

      {sprintError && (
        <Alert variant="danger" className="mb-3" onClose={() => setSprintError(null)} dismissible>
          {sprintError}
        </Alert>
      )}

      {sprintResult && (
        <div
          className="p-3 mb-3"
          style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12 }}
        >
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
            <div className="fw-bold d-flex align-items-center gap-2" style={{ color: "#111827" }}>
              <FaCheckCircle size={13} style={{ color: "#059669" }} />
              Fix Sprint complete — {(sprintResult.applied || []).length} issue(s) fixed
            </div>
            {sprintResult.pr_url && (
              <a href={sprintResult.pr_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline-primary" size="sm">View Pull Request <FaArrowRight size={10} className="ms-1" /></Button>
              </a>
            )}
          </div>
          {sprintResult.pr_warning && (
            <div className="text-muted small mb-2">Branch pushed, but PR creation had an issue: {sprintResult.pr_warning}</div>
          )}
          <ul className="small mb-0 ps-3">
            {(sprintResult.applied || []).map((a: any) => (
              <li key={a.issue_id} style={{ color: "#059669" }}>{a.title} <span className="text-muted">({a.file_path})</span></li>
            ))}
            {(sprintResult.skipped || []).map((s: any) => (
              <li key={s.issue_id} style={{ color: "#6B7280" }}>
                Skipped: {s.title} <span className="text-muted">— {s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Findings header */}
      <div className="d-flex justify-content-between align-items-baseline mb-2 px-1">
        <h6 className="mb-0 fw-bold" style={{ color: "#111827" }}>
          Findings
          <span className="text-muted ms-2 fw-normal">({findings.length})</span>
        </h6>
        {hasFilter && (
          <span className="text-muted small">
            filtered{severity && ` · severity=${severity}`}{category && ` · category=${category}`}
          </span>
        )}
      </div>

      {/* Findings list */}
      {findings.length === 0 ? (
        <div
          className="text-center py-5 px-4"
          style={{
            background: "white",
            border: "2px dashed #E5E7EB",
            borderRadius: 12,
          }}
        >
          <h6 className="fw-semibold mb-2">
            {hasFilter ? "No findings match the current filters" : "No findings"}
          </h6>
          <p className="text-muted small mb-3">
            {hasFilter
              ? "Try removing a filter to see more results."
              : "This review came back clean. 🎉"}
          </p>
          {hasFilter && (
            <Button variant="outline-secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div
          style={{
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {findings.map((f, idx) => {
            const isLast = idx === findings.length - 1;
            const sevBg = severityColor(f.severity);
            return (
              <div
                key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => { setSelectedIssue(f); setShowDrawer(true); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedIssue(f);
                    setShowDrawer(true);
                  }
                }}
                className="d-flex align-items-start px-3 py-3"
                style={{
                  borderBottom: isLast ? "none" : "1px solid #F3F4F6",
                  cursor: "pointer",
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              >
                {/* Severity pill */}
                <span
                  style={{
                    background: sevBg,
                    color: "white",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    padding: "3px 8px",
                    borderRadius: 4,
                    flexShrink: 0,
                    minWidth: 70,
                    textAlign: "center",
                  }}
                >
                  {(f.severity || "—").toUpperCase()}
                </span>

                {/* Body */}
                <div className="ms-3 flex-grow-1" style={{ minWidth: 0 }}>
                  <div
                    className="fw-semibold d-flex align-items-center gap-2"
                    style={{ color: "#111827", fontSize: "0.92rem" }}
                  >
                    {/* AI agent findings get a brain icon so they're easy to
                        spot among static-tool findings. */}
                    {((f as any).module === "ai" ||
                      (f as any).tool === "dimension_ai" ||
                      (typeof f.id === "string" && f.id.startsWith("ai-agent-"))) && (
                      <span
                        title="AI Senior Engineer finding"
                        aria-label="AI Senior Engineer finding"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          background: "linear-gradient(135deg, #4F46E5, #06B6D4)",
                          color: "white",
                          flexShrink: 0,
                        }}
                      >
                        <FaBrain size={10} />
                      </span>
                    )}
                    <span>{f.message || "—"}</span>
                  </div>
                  <div className="text-muted small mt-1 d-flex flex-wrap gap-2 align-items-center">
                    {f.category && (
                      <Badge
                        bg="light"
                        text="dark"
                        className="text-uppercase"
                        style={{ fontSize: "0.65rem", letterSpacing: "0.04em" }}
                      >
                        {f.category}
                      </Badge>
                    )}
                    {f.file && (
                      <code style={{ fontSize: "0.78rem" }}>
                        {f.file}{f.start_line != null ? `:${f.start_line}` : ""}
                      </code>
                    )}
                    {f.confidence != null && (
                      <span style={{ fontSize: "0.78rem" }}>
                        confidence {Math.round(f.confidence * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                <FaArrowRight size={11} className="text-muted ms-3 mt-2 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      <IssueDetailDrawer
        show={showDrawer}
        onHide={() => setShowDrawer(false)}
        issue={selectedIssue}
      />
    </Container>
  );
}
