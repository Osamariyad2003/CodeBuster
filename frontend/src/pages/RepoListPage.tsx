import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Spinner,
  Alert,
  Button,
  Form,
  InputGroup,
} from "react-bootstrap";
import {
  FaGithub,
  FaRobot,
  FaInbox,
  FaCog,
  FaSearch,
  FaExternalLinkAlt,
  FaPlus,
} from "react-icons/fa";
import { codebusterApi, Repo, RepoHealth } from "../api/codebuster";

const gradeColor = (grade?: string | null): string => {
  switch (grade) {
    case "A": return "#059669"; // emerald
    case "B": return "#4F46E5"; // indigo
    case "C": return "#F59E0B"; // amber
    case "D": return "#EF4444"; // red
    case "F": return "#991B1B"; // dark red
    default:  return "#9CA3AF"; // gray
  }
};

const scoreColor = (score?: number | null): string => {
  if (score == null) return "#9CA3AF";
  if (score >= 85) return "#059669";
  if (score >= 70) return "#4F46E5";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
};

interface RepoCardProps {
  repo: Repo;
  health?: RepoHealth;
}

const RepoCard: React.FC<RepoCardProps> = ({ repo, health }) => {
  const [hover, setHover] = useState(false);
  const score = health?.latest_score ?? null;
  const grade = health?.latest_grade ?? null;

  return (
    <div
      className="p-3 h-100 d-flex flex-column"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "white",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        boxShadow: hover
          ? "0 4px 12px rgba(0, 0, 0, 0.06)"
          : "0 1px 2px rgba(0, 0, 0, 0.02)",
        transform: hover ? "translateY(-2px)" : "none",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      {/* Header: icon + name + grade badge */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "#F3F4F6",
            color: "#374151",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <FaGithub size={16} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="fw-semibold text-truncate"
            title={repo.full_name}
            style={{ fontSize: "0.95rem", color: "#111827" }}
          >
            {repo.full_name}
          </div>
          {repo.default_branch && (
            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
              {repo.default_branch}
            </div>
          )}
        </div>
        {grade && (
          <div
            title={`Grade ${grade}`}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: gradeColor(grade),
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            {grade}
          </div>
        )}
      </div>

      {/* Health score with progress bar */}
      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-baseline mb-1">
          <span className="small text-muted">Health score</span>
          <span
            className="fw-semibold"
            style={{ color: scoreColor(score), fontSize: "0.9rem" }}
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

      {/* Primary actions */}
      <div className="d-flex gap-2 mt-auto">
        <Button
          as={Link as any}
          to={`/agents?repo=${encodeURIComponent(repo.full_name)}`}
          variant="primary"
          size="sm"
          className="flex-grow-1 d-flex align-items-center justify-content-center"
        >
          <FaRobot size={12} className="me-1" /> Agents
        </Button>
        <Button
          as={Link as any}
          to={`/commits?repo_id=${encodeURIComponent(repo.id)}`}
          variant="outline-secondary"
          size="sm"
          className="flex-grow-1 d-flex align-items-center justify-content-center"
        >
          <FaInbox size={12} className="me-1" /> Commits
        </Button>
        <Button
          as={Link as any}
          to={`/repos/${repo.id}/settings`}
          variant="outline-secondary"
          size="sm"
          title="Repository settings"
          className="d-flex align-items-center justify-content-center"
          style={{ minWidth: 36 }}
        >
          <FaCog size={12} />
        </Button>
      </div>

      {/* Latest review link */}
      {health?.latest_review_id ? (
        <Link
          to={`/reviews/${health.latest_review_id}`}
          className="small mt-3 text-decoration-none d-inline-flex align-items-center"
          style={{ color: "#6366F1" }}
        >
          <FaExternalLinkAlt size={10} className="me-1" />
          View latest review
        </Link>
      ) : (
        <div className="small text-muted mt-3">No reviews yet</div>
      )}
    </div>
  );
};

export default function RepoListPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [health, setHealth] = useState<Record<string, RepoHealth>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await codebusterApi.getRepos();
        if (cancelled) return;
        const repoList = Array.isArray(list) ? list : [];
        setRepos(repoList);
        const map: Record<string, RepoHealth> = {};
        await Promise.all(
          repoList.map(async (r) => {
            try {
              const h = await codebusterApi.getRepoHealth(r.id);
              if (!cancelled) map[r.id] = h;
            } catch {
              // ignore per-repo
            }
          })
        );
        if (!cancelled) setHealth(map);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load repos");
        if (!cancelled) setRepos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRepos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.full_name.toLowerCase().includes(q));
  }, [repos, query]);

  const summary = useMemo(() => {
    const scores = Object.values(health)
      .map((h) => h.latest_score)
      .filter((v): v is number => v != null);
    const avg =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;
    const reviewed = Object.values(health).filter(
      (h) => h.latest_review_id
    ).length;
    return { avg, reviewed };
  }, [health]);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />{" "}
        <span className="text-muted">Loading repositories…</span>
      </Container>
    );
  }
  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4" style={{ maxWidth: 1200 }}>
      {/* Page header */}
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          <h4 className="mb-1 fw-bold" style={{ color: "#111827" }}>
            Repositories
          </h4>
          <div className="text-muted small">
            {repos.length === 0
              ? "No repositories connected yet"
              : (
                <>
                  {repos.length} connected
                  {summary.avg != null && (
                    <>
                      {" · "}
                      <span style={{ color: scoreColor(summary.avg), fontWeight: 600 }}>
                        avg health {summary.avg}/100
                      </span>
                    </>
                  )}
                  {summary.reviewed > 0 && (
                    <> · {summary.reviewed} reviewed</>
                  )}
                </>
              )}
          </div>
        </div>
        <Button
          as={Link as any}
          to="/repos/search"
          variant="primary"
          className="d-flex align-items-center"
        >
          <FaPlus size={12} className="me-2" />
          Connect repository
        </Button>
      </div>

      {/* Search bar (only when we have a few repos) */}
      {repos.length > 3 && (
        <InputGroup className="mb-4" style={{ maxWidth: 420 }}>
          <InputGroup.Text style={{ background: "white", borderRight: 0 }}>
            <FaSearch size={12} className="text-muted" />
          </InputGroup.Text>
          <Form.Control
            placeholder="Search repositories…"
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

      {/* Repo grid / empty state */}
      {repos.length === 0 ? (
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
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#F3F4F6",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6B7280",
              marginBottom: 16,
            }}
          >
            <FaGithub size={28} />
          </div>
          <h5 className="fw-semibold mb-2">No repositories connected</h5>
          <p className="text-muted mb-4">
            Connect a GitHub repository to start automated code reviews and
            fixes.
          </p>
          <Button
            as={Link as any}
            to="/repos/search"
            variant="primary"
            className="d-inline-flex align-items-center"
          >
            <FaPlus size={12} className="me-2" />
            Connect your first repository
          </Button>
        </div>
      ) : filteredRepos.length === 0 ? (
        <Alert variant="light" className="border text-center py-4">
          No repositories match <strong>"{query}"</strong>.{" "}
          <Button
            variant="link"
            className="p-0 align-baseline"
            onClick={() => setQuery("")}
          >
            Clear search
          </Button>
        </Alert>
      ) : (
        <Row className="g-3">
          {filteredRepos.map((r) => (
            <Col key={r.id} md={6} lg={4}>
              <RepoCard repo={r} health={health[r.id]} />
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}
