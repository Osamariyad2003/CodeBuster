import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Spinner,
  Alert,
  Button,
  Form,
  InputGroup,
} from "react-bootstrap";
import {
  FaCodeBranch,
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaArrowRight,
} from "react-icons/fa";
import { codebusterApi, ReviewList } from "../api/codebuster";
import { useAuth } from "../AuthContext";

const PAGE_SIZE = 20;

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

const formatDate = (iso?: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function ReviewsListPage() {
  const { connectedRepos = [] } = useAuth() as { connectedRepos: any[] };
  const [data, setData] = useState<ReviewList | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    codebusterApi
      .getReviews({ page, page_size: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || "Failed to load reviews");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page]);

  // Map repo UUID → full_name so the table shows owner/name instead of an opaque ID.
  const repoNameById = useMemo(() => {
    const map: Record<string, string> = {};
    (connectedRepos || []).forEach((r: any) => {
      if (r?.id && r?.full_name) map[r.id] = r.full_name;
    });
    return map;
  }, [connectedRepos]);

  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Client-side text filter on top of the server-paged list.
  const filteredReviews = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) => {
      const name = r.repo_name || repoNameById[r.repo_id] || r.repo_id;
      return (
        name.toLowerCase().includes(q) ||
        (r.overall_grade || "").toLowerCase().includes(q)
      );
    });
  }, [reviews, query, repoNameById]);

  if (loading && !data) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />{" "}
        <span className="text-muted">Loading reviews…</span>
      </Container>
    );
  }
  if (error && !data) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4" style={{ maxWidth: 1100 }}>
      {/* Page header */}
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          <h4 className="mb-1 fw-bold" style={{ color: "#111827" }}>
            Reviews
          </h4>
          <div className="text-muted small">
            {total === 0
              ? "No reviews yet"
              : (
                <>
                  {total} review{total === 1 ? "" : "s"} across all connected repositories
                  {totalPages > 1 && <> · page {page} of {totalPages}</>}
                </>
              )}
          </div>
        </div>
      </div>

      {/* Search */}
      {reviews.length > 5 && (
        <InputGroup className="mb-3" style={{ maxWidth: 420 }}>
          <InputGroup.Text style={{ background: "white", borderRight: 0 }}>
            <FaSearch size={12} className="text-muted" />
          </InputGroup.Text>
          <Form.Control
            placeholder="Filter by repo or grade…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ borderLeft: 0 }}
          />
          {query && (
            <Button
              variant="outline-secondary"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ×
            </Button>
          )}
        </InputGroup>
      )}

      {/* List of reviews — card-style rows */}
      {reviews.length === 0 ? (
        <div
          className="text-center py-5 px-4"
          style={{
            background: "white",
            border: "2px dashed #E5E7EB",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#F3F4F6",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6B7280",
              marginBottom: 14,
            }}
          >
            <FaCodeBranch size={22} />
          </div>
          <h6 className="fw-semibold mb-2">No reviews yet</h6>
          <p className="text-muted small mb-3">
            Run a scan from the Commits inbox or push a commit to a connected
            repo to create your first review.
          </p>
          <Button as={Link as any} to="/commits" variant="primary" size="sm">
            Open Commits
          </Button>
        </div>
      ) : filteredReviews.length === 0 ? (
        <Alert variant="light" className="border text-center py-3">
          No reviews on this page match <strong>"{query}"</strong>.{" "}
          <Button
            variant="link"
            className="p-0 align-baseline"
            onClick={() => setQuery("")}
          >
            Clear filter
          </Button>
        </Alert>
      ) : (
        <div
          style={{
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {filteredReviews.map((r, idx) => {
            const repoName = r.repo_name || repoNameById[r.repo_id] || r.repo_id;
            const score = r.overall_score ?? null;
            const grade = r.overall_grade ?? null;
            const isLast = idx === filteredReviews.length - 1;
            return (
              <Link
                key={r.id}
                to={`/reviews/${r.id}`}
                className="d-flex align-items-center px-3 py-3 text-decoration-none"
                style={{
                  borderBottom: isLast ? "none" : "1px solid #F3F4F6",
                  color: "inherit",
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              >
                {/* Grade badge */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: gradeColor(grade),
                    color: "white",
                    fontWeight: 700,
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  title={grade ? `Grade ${grade}` : "No grade"}
                >
                  {grade || "—"}
                </div>

                {/* Repo + relative date */}
                <div className="ms-3" style={{ minWidth: 0, flex: 1 }}>
                  <div
                    className="fw-semibold text-truncate"
                    style={{ fontSize: "0.95rem", color: "#111827" }}
                    title={repoName}
                  >
                    {repoName}
                  </div>
                  <div className="text-muted small">
                    {formatDate(r.created_at)}
                    {r.completed_at && r.completed_at !== r.created_at && (
                      <> · completed {formatDate(r.completed_at)}</>
                    )}
                  </div>
                </div>

                {/* Score with repo name chip + progress bar */}
                <div
                  className="ms-3 d-none d-sm-flex flex-column align-items-end"
                  style={{ width: 160, flexShrink: 0, gap: 4 }}
                >
                  {/* Repo name chip */}
                  <div
                    className="text-truncate"
                    style={{
                      maxWidth: 156,
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "#6B7280",
                      background: "#F3F4F6",
                      borderRadius: 6,
                      padding: "2px 7px",
                    }}
                    title={repoName}
                  >
                    {repoName}
                  </div>
                  {/* Score row */}
                  <div className="d-flex align-items-center gap-2 w-100">
                    <div
                      style={{
                        flex: 1,
                        height: 4,
                        background: "#F3F4F6",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      {score != null && (
                        <div
                          style={{
                            width: `${Math.max(2, Math.min(100, score))}%`,
                            height: "100%",
                            background: scoreColor(score),
                          }}
                        />
                      )}
                    </div>
                    <span
                      className="fw-bold"
                      style={{ color: scoreColor(score), fontSize: "0.85rem", whiteSpace: "nowrap" }}
                    >
                      {score != null ? `${score}/100` : "—"}
                    </span>
                  </div>
                </div>

                {/* Trailing arrow */}
                <FaArrowRight
                  size={12}
                  className="ms-3 text-muted flex-shrink-0"
                />
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <span className="text-muted small">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="d-flex align-items-center gap-2">
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="d-flex align-items-center"
            >
              <FaChevronLeft size={10} className="me-1" /> Previous
            </Button>
            <span className="small text-muted px-2">
              Page <strong>{page}</strong> of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="d-flex align-items-center"
            >
              Next <FaChevronRight size={10} className="ms-1" />
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}
