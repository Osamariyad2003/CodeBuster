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
  FaEye,
  FaCog,
  FaSearch,
  FaExternalLinkAlt,
  FaPlus,
  FaWrench,
} from "react-icons/fa";
import { codebusterApi, Repo, RepoHealth } from "../api/codebuster";

const gradeColor = (grade?: string | null): string => {
  switch (grade) {
    case "A": return "#25E2A8"; // emerald
    case "B": return "#687FF5"; // indigo
    case "C": return "#F59E0B"; // amber
    case "D": return "#EF4444"; // red
    case "F": return "#B91C1C"; // dark red
    default:  return "#64748B"; // gray
  }
};

const scoreColor = (score?: number | null): string => {
  if (score == null) return "#64748B";
  if (score >= 85) return "#25E2A8";
  if (score >= 70) return "#687FF5";
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
      className="p-3.5 h-100 d-flex flex-column cb-card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-default)",
        borderRadius: 14,
        padding: "18px",
        boxShadow: hover
          ? "var(--shadow-md), 0 0 0 1px rgba(99, 102, 241, 0.25)"
          : "var(--shadow-sm)",
        transform: hover ? "translateY(-2px)" : "none",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Header: icon + name + grade badge */}
      <div className="d-flex align-items-center gap-3 mb-3">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "var(--surface-card-elevated)",
            border: "1px solid var(--border-default)",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <FaGithub size={18} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="fw-bold text-truncate"
            title={repo.full_name}
            style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}
          >
            {repo.full_name}
          </div>
          {repo.default_branch && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              branch: <span className="text-secondary">{repo.default_branch}</span>
            </div>
          )}
        </div>
        {grade && (
          <div
            title={`Grade ${grade}`}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: gradeColor(grade) + "20",
              border: `1.5px solid ${gradeColor(grade)}`,
              color: gradeColor(grade),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 16,
              boxShadow: `0 0 12px ${gradeColor(grade)}30`,
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
          <span className="small text-muted" style={{ fontSize: "0.78rem" }}>Health score</span>
          <span
            className="fw-bold"
            style={{ color: scoreColor(score), fontSize: "0.9rem" }}
          >
            {score != null ? `${score}/100` : "—"}
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: "var(--surface-card-elevated)",
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {score != null && (
            <div
              style={{
                width: `${Math.max(2, Math.min(100, score))}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${scoreColor(score)}, ${scoreColor(score)}CC)`,
                boxShadow: `0 0 8px ${scoreColor(score)}60`,
                transition: "width 0.4s ease",
              }}
            />
          )}
        </div>
      </div>

      {/* Primary actions */}
      <div className="d-flex gap-2 mt-auto">
        <Button
          as={Link as any}
          to={`/repos/${repo.id}`}
          variant="primary"
          size="sm"
          className="flex-grow-1 d-flex align-items-center justify-content-center"
          style={{ borderRadius: 8, fontWeight: 600 }}
        >
          <FaEye size={12} className="me-1.5" /> Dashboard
        </Button>
        <Button
          as={Link as any}
          to={`/issues?repo_id=${encodeURIComponent(repo.id)}`}
          variant="outline-secondary"
          size="sm"
          title="Issues & Patches"
          className="d-flex align-items-center justify-content-center"
          style={{ minWidth: 38, borderRadius: 8 }}
        >
          <FaWrench size={12} />
        </Button>
        <Button
          as={Link as any}
          to={`/repos/${repo.id}/settings`}
          variant="outline-secondary"
          size="sm"
          title="Repository settings"
          className="d-flex align-items-center justify-content-center"
          style={{ minWidth: 38, borderRadius: 8 }}
        >
          <FaCog size={13} />
        </Button>
      </div>

      {/* Latest review link */}
      {health?.latest_review_id ? (
        <Link
          to={`/reviews/${health.latest_review_id}`}
          className="small mt-3 text-decoration-none d-inline-flex align-items-center"
          style={{ color: "var(--sidebar-accent, #FF570A)", fontSize: "0.8rem", fontWeight: 500 }}
        >
          <FaExternalLinkAlt size={10} className="me-1.5" />
          View latest review
        </Link>
      ) : (
        <div className="small mt-3" style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
          No reviews yet
        </div>
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
        <span className="text-muted ms-2">Loading repositories…</span>
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
          <h2 className="mb-1 fw-bold" style={{ color: "var(--text-primary)", fontSize: "1.65rem", letterSpacing: "-0.02em" }}>
            Repositories
          </h2>
          <div className="small" style={{ color: "var(--text-secondary)" }}>
            {repos.length === 0
              ? "No repositories connected yet"
              : (
                <>
                  <span className="fw-semibold" style={{ color: "var(--text-primary)" }}>{repos.length}</span> connected
                  {summary.avg != null && (
                    <>
                      {" · "}
                      <span style={{ color: scoreColor(summary.avg), fontWeight: 700 }}>
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
          style={{ borderRadius: 10, padding: "8px 16px", fontWeight: 600 }}
        >
          <FaPlus size={12} className="me-2" />
          Connect repository
        </Button>
      </div>

      {/* Search bar (only when we have repos) */}
      {repos.length > 3 && (
        <InputGroup className="mb-4" style={{ maxWidth: 420 }}>
          <InputGroup.Text
            style={{
              background: "var(--surface-card)",
              borderColor: "var(--border-default)",
              borderRight: 0,
              color: "var(--text-muted)",
              borderRadius: "10px 0 0 10px",
            }}
          >
            <FaSearch size={12} />
          </InputGroup.Text>
          <Form.Control
            placeholder="Search repositories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              background: "var(--surface-card)",
              borderColor: "var(--border-default)",
              borderLeft: 0,
              color: "var(--text-primary)",
              borderRadius: query ? 0 : "0 10px 10px 0",
            }}
          />
          {query && (
            <Button
              variant="outline-secondary"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              style={{ borderRadius: "0 10px 10px 0" }}
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
            background: "var(--surface-card)",
            border: "2px dashed var(--border-default)",
            borderRadius: 16,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "var(--surface-card-elevated)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              marginBottom: 16,
            }}
          >
            <FaGithub size={28} />
          </div>
          <h5 className="fw-semibold mb-2" style={{ color: "var(--text-primary)" }}>No repositories connected</h5>
          <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
            Connect a GitHub repository to start automated code reviews and
            fixes.
          </p>
          <Button
            as={Link as any}
            to="/repos/search"
            variant="primary"
            className="d-inline-flex align-items-center"
            style={{ borderRadius: 10, fontWeight: 600 }}
          >
            <FaPlus size={12} className="me-2" />
            Connect your first repository
          </Button>
        </div>
      ) : filteredRepos.length === 0 ? (
        <Alert variant="secondary" className="text-center py-4" style={{ borderRadius: 12 }}>
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
