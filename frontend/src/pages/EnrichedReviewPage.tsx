/**
 * AI Reviews–style page: Overview with status bar, time filters, Issues found &
 * Comment categories cards. Matches reference dark UI (Graphite / AI Reviews).
 */

import React, { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Alert, Button, Spinner, Form, Dropdown } from "react-bootstrap";
import { useAuth } from "../AuthContext";
import EnrichedReviewView from "../components/enrichedReview/EnrichedReviewView";
import {
  runEnrichedReview,
  enrichIssuesWithClaude,
  type SonarQubeIssueLike,
} from "../api/enrichedReview";
import type { EnrichedReviewResponse } from "../types/enrichedReview";

const COMMENT_CATEGORIES = [
  "Logic bug",
  "Security issue",
  "Accidentally committed code",
  "Performance issue",
  "Code quality/style",
  "Documentation issue",
  "Potential edge case",
];

const AI_REVIEW_REPOS_KEY = "ai_review_repo_ids";

export default function EnrichedReviewPage() {
  const { repoId, tab } = useParams<{ repoId?: string; tab?: string }>();
  const navigate = useNavigate();
  const { connectedRepos = [] } = useAuth();

  useEffect(() => {
    if (tab === "feed" || tab === "rules") {
      navigate("/enriched-review", { replace: true });
    }
  }, [tab, navigate]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EnrichedReviewResponse | null>(null);
  const [projectName, setProjectName] = useState("codebuster");
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteJson, setPasteJson] = useState("");
  const [aiReviewRepoIds, setAiReviewRepoIds] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem(AI_REVIEW_REPOS_KEY);
      if (s) return JSON.parse(s);
    } catch (_) {}
    return [];
  });

  useEffect(() => {
    if (connectedRepos.length && aiReviewRepoIds.length === 0) {
      setAiReviewRepoIds(connectedRepos.map((r: { id: string }) => r.id));
    }
  }, [connectedRepos.length]);

  useEffect(() => {
    try {
      localStorage.setItem(AI_REVIEW_REPOS_KEY, JSON.stringify(aiReviewRepoIds));
    } catch (_) {}
  }, [aiReviewRepoIds]);

  const toggleAiReviewRepo = (id: string) => {
    setAiReviewRepoIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const runScanRepoId = repoId || (aiReviewRepoIds.length > 0 ? aiReviewRepoIds[0] : undefined);

  const runScan = useCallback(async () => {
    setError(null);
    setData(null);
    setLoading(true);
    try {
      const result = await runEnrichedReview({
        repoId: runScanRepoId,
        project: projectName,
      });
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Failed to run enriched review");
    } finally {
      setLoading(false);
    }
  }, [runScanRepoId, projectName]);

  const runFromPaste = useCallback(async () => {
    setError(null);
    setData(null);
    setLoading(true);
    try {
      const parsed = JSON.parse(pasteJson) as { issues?: SonarQubeIssueLike[]; [k: string]: any };
      const rawIssues = parsed?.issues ?? [];
      const result = await enrichIssuesWithClaude({
        project: projectName,
        raw_issues: rawIssues,
      });
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Invalid JSON or enrich request failed");
    } finally {
      setLoading(false);
    }
  }, [projectName, pasteJson]);

  const issueCount = data?.issue_list?.length ?? 0;
  const categoryCounts = React.useMemo(() => {
    if (!data?.issue_list?.length) {
      return COMMENT_CATEGORIES.map((c) => ({ name: c, count: 0 }));
    }
    const tagCount: Record<string, number> = {};
    COMMENT_CATEGORIES.forEach((c) => (tagCount[c] = 0));
    data.issue_list.forEach((issue) => {
      (issue.tags || []).forEach((t) => {
        const key = COMMENT_CATEGORIES.find((cat) => cat.toLowerCase().includes(t.toLowerCase())) || t;
        if (!tagCount[key]) tagCount[key] = 0;
        tagCount[key]++;
      });
    });
    return COMMENT_CATEGORIES.map((name) => ({ name, count: tagCount[name] || 0 }));
  }, [data?.issue_list]);
  const maxCategoryCount = Math.max(1, ...categoryCounts.map((c) => c.count));

  const isOverview = !tab || tab === "overview";
  const isSettings = tab === "settings";

  return (
    <div className="ai-reviews-page">
      {/* Status bar: link to repos, show connected count */}
      <div className="ai-reviews-status-bar">
        <div className="ai-reviews-status-bar__left">
          Enabled in{" "}
          <Link to="/repos" className="ai-reviews-status-bar__link">
            {connectedRepos.length === 1
              ? "1 repository"
              : `${connectedRepos.length} repositories`}
          </Link>
          {connectedRepos.length === 0 && (
            <span className="text-muted small ms-1">(connect repos to run AI review)</span>
          )}
        </div>
      </div>

      {isOverview && (
        <>
          <div className="ai-reviews-overview-bar">
            <h1 className="ai-reviews-overview-bar__title">Overview</h1>
            <div className="ms-auto">
              <Dropdown align="end">
                <Dropdown.Toggle
                  variant="outline-secondary"
                  size="sm"
                  id="ai-review-repos-dropdown"
                  style={{ minWidth: 180 }}
                >
                  {aiReviewRepoIds.length === 0
                    ? "Select repos for AI review"
                    : aiReviewRepoIds.length === 1
                    ? "1 repo selected"
                    : `${aiReviewRepoIds.length} repos selected`}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {(connectedRepos as { id: string; full_name?: string }[]).map((repo) => (
                    <Dropdown.Item
                      key={repo.id}
                      as="label"
                      className="d-flex align-items-center gap-2 mb-0"
                      style={{ cursor: "pointer" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={aiReviewRepoIds.includes(repo.id)}
                        onChange={() => toggleAiReviewRepo(repo.id)}
                      />
                      <span className="text-truncate">{repo.full_name || repo.id}</span>
                    </Dropdown.Item>
                  ))}
                  {connectedRepos.length === 0 && (
                    <Dropdown.Item as={Link} to="/repos" className="text-muted small">
                      Connect repositories first
                    </Dropdown.Item>
                  )}
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </div>

          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-3">
              {error}
            </Alert>
          )}

          <div className="row g-3">
            {/* Issues found card */}
            <div className="col-12 col-lg-6">
              <div className="ai-reviews-card ai-reviews-card--issues">
                <h2 className="ai-reviews-card__title">Overview</h2>
                <div className="ai-reviews-card__value">{loading ? "—" : issueCount}</div>
                <div className="ai-reviews-card__label">Issues found</div>
                <div
                  className="ai-reviews-insight-card__chart"
                  style={{ minHeight: 80 }}
                  aria-hidden
                >
                  {!loading && (
                    <div className="d-flex align-items-end gap-1 p-2 h-100" style={{ gap: 4 }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            height: `${Math.max(8, (issueCount || 0) * 5 + i * 10)}%`,
                            background: "var(--sidebar-accent)",
                            borderRadius: 4,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2 mt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => runScan()}
                    disabled={loading}
                    type="button"
                  >
                    {loading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Running…
                      </>
                    ) : (
                      "Run scan & enrich"
                    )}
                  </Button>
                  <Form.Check
                    type="switch"
                    id="paste-mode-overview"
                    label="Paste JSON"
                    checked={pasteMode}
                    onChange={(e) => setPasteMode(e.target.checked)}
                    className="small text-secondary"
                  />
                </div>
                {pasteMode && (
                  <div className="mt-2">
                    <Form.Control
                      as="textarea"
                      rows={3}
                      placeholder='Paste SonarQube JSON: { "issues": [ ... ] }'
                      value={pasteJson}
                      onChange={(e) => setPasteJson(e.target.value)}
                      className="font-monospace small bg-dark border-secondary text-light"
                    />
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="mt-1"
                      onClick={() => runFromPaste()}
                      disabled={loading || !pasteJson.trim()}
                      type="button"
                    >
                      Enrich from JSON
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Comment categories: only when we have scan results with tags */}
            {data && issueCount > 0 && maxCategoryCount > 0 && (
              <div className="col-12 col-lg-6">
                <div className="ai-reviews-card">
                  <h2 className="ai-reviews-card__title">Comment categories</h2>
                  <ul className="ai-reviews-categories">
                    {categoryCounts.map(({ name, count }) => (
                      <li key={name} className="ai-reviews-categories__item">
                        <span>{name}</span>
                        <div className="ai-reviews-categories__bar">
                          <div
                            className="ai-reviews-categories__bar-fill"
                            style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-muted small" style={{ minWidth: 24, textAlign: "right" }}>
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* AI review result: always show when we have a response (even 0 issues) */}
          {data && (
            <div className="mt-4 ai-reviews-card p-3">
              <h3 className="mb-2">AI review result</h3>
              <p className="text-muted small mb-3">
                <span className="me-2">{data.project}</span>
                <span>{data.scan_source}</span>
              </p>
              {data.issue_list.length > 0 ? (
                <EnrichedReviewView data={data} viewMode="table" />
              ) : (
                <p className="text-muted mb-0">
                  No issues found. Run a scan on the repository first (from Repositories → repo → Run scan), then run &quot;Run scan & enrich&quot; again to get AI-enriched results.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {isSettings && (
        <div className="ai-reviews-settings-view">
          <h1 className="ai-reviews-overview-bar__title mb-3">Settings</h1>
          <div className="ai-reviews-card p-4">
            <h3 className="h6 mb-2">Run scan</h3>
            <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
              <Form.Control
                style={{ width: 160 }}
                placeholder="Project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
              <Button variant="primary" onClick={() => runScan()} disabled={loading} type="button">
                {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                Run scan & enrich
              </Button>
            </div>
            <Form.Check
              type="switch"
              id="paste-mode-settings"
              label="Paste SonarQube JSON instead"
              checked={pasteMode}
              onChange={(e) => setPasteMode(e.target.checked)}
            />
            {pasteMode && (
              <>
                <Form.Control
                  as="textarea"
                  rows={6}
                  placeholder='{ "issues": [ ... ] }'
                  value={pasteJson}
                  onChange={(e) => setPasteJson(e.target.value)}
                  className="font-monospace small mt-2 bg-dark border-secondary text-light"
                />
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => runFromPaste()}
                  disabled={loading || !pasteJson.trim()}
                  type="button"
                >
                  Enrich from JSON
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
