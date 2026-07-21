/**
 * Commits (Gerrit) Inbox: select a project to review, then categories sidebar + commit list.
 * Single-select project dropdown; "Run Gerrit" navigates to review result.
 */
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FaChevronDown, FaChevronRight, FaCheck, FaUser } from "react-icons/fa";
import { fetchGerritCommits, runGerritReview } from "../api/gerrit";
import { getJob } from "../lib/apiClient";
import { useAuth } from "../AuthContext";

const STORAGE_KEY = "commits_inbox_project_id";

const CATEGORY_IDS = [
  "needs_review",
  "returned",
  "approved",
  "waiting_for_reviewers",
  "drafts",
  "merging",
  "waiting_for_author",
];

export default function CommitsInboxPage() {
  const { connectedRepos = [] } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ categories: [], commits: [] });
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    // URL wins → localStorage → null
    const fromUrl = searchParams.get("repo_id");
    if (fromUrl) return fromUrl;
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) return JSON.parse(s);
    } catch (_) {}
    return null;
  });
  const [expandedCategory, setExpandedCategory] = useState("needs_review");
  const [runLoading, setRunLoading] = useState(null);
  const pollRef = useRef(null);

  // Auto-select first connected repo if none selected
  useEffect(() => {
    if (!selectedProjectId && connectedRepos?.length > 0) {
      setSelectedProjectId(connectedRepos[0].id);
    }
  }, [connectedRepos?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch commits when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setData({ categories: [], commits: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchGerritCommits(selectedProjectId)
      .then((res) => {
        const allCommits = res.commits || [];
        const categoryCounts = {};
        CATEGORY_IDS.forEach((id) => (categoryCounts[id] = 0));
        allCommits.forEach((c) => {
          const cat = c.category || "needs_review";
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        setData({
          categories: CATEGORY_IDS.map((id) => ({
            id,
            label: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            count: categoryCounts[id] || 0,
          })),
          commits: allCommits,
        });
      })
      .catch(() => setData({ categories: [], commits: [] }))
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  // Persist selection to localStorage AND keep the URL in sync (deep-linkable)
  useEffect(() => {
    if (selectedProjectId) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProjectId));
      } catch (_) {}
    }
    const currentInUrl = searchParams.get("repo_id") || null;
    if (currentInUrl === (selectedProjectId || null)) return;
    const next = new URLSearchParams(searchParams);
    if (selectedProjectId) next.set("repo_id", selectedProjectId);
    else next.delete("repo_id");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  // React to external URL changes (e.g. clicking a Commits link from the Repositories page)
  useEffect(() => {
    const urlId = searchParams.get("repo_id");
    if (urlId && urlId !== selectedProjectId) {
      setSelectedProjectId(urlId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleRunGerrit = (repoId, commitSha) => {
    setRunLoading(commitSha || repoId);
    runGerritReview(repoId, commitSha)
      .then((res) => {
        if (!res?.success) {
          setRunLoading(null);
          return;
        }
        // Idempotent: review already exists → navigate directly
        if (res.idempotent && res.review_id) {
          setRunLoading(null);
          navigate(`/reviews/${res.review_id}`);
          return;
        }
        // Job queued: poll until complete, then navigate
        if (res.job_id) {
          pollForReview(res.job_id);
          return;
        }
        // Inline: poll latest review for this repo
        if (res.inline) {
          pollForLatestReview(repoId);
          return;
        }
        setRunLoading(null);
      })
      .catch(() => setRunLoading(null));
  };

  const pollForReview = (jobId) => {
    let attempts = 0;
    const maxAttempts = 30;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setRunLoading(null);
        return;
      }
      getJob(jobId)
        .then((job) => {
          if (job?.status === "completed" || job?.status === "SUCCESS") {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setRunLoading(null);
            const reviewId = job.result?.review_id || job.review_id;
            if (reviewId) {
              navigate(`/reviews/${reviewId}`);
            }
          } else if (job?.status === "failed" || job?.status === "FAILURE") {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setRunLoading(null);
          }
        })
        .catch(() => {});
    }, 5000);
  };

  const pollForLatestReview = (repoId) => {
    let attempts = 0;
    const maxAttempts = 30;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setRunLoading(null);
        return;
      }
      import("../lib/apiClient").then(({ getLatestReview }) => {
        getLatestReview(repoId).then((res) => {
          if (res?.review?.id) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setRunLoading(null);
            navigate(`/reviews/${res.review.id}`);
          }
        }).catch(() => {});
      });
    }, 5000);
  };

  const categories = data.categories?.length
    ? data.categories
    : CATEGORY_IDS.map((id) => ({
        id,
        label: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        count: 0,
      }));

  const commitsByCategory = (data.commits || []).reduce((acc, c) => {
    const cat = c.category || "needs_review";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  const selectedRepo = (connectedRepos || []).find((r) => r.id === selectedProjectId);

  return (
    <div className="commits-inbox d-flex flex-column h-100">
      {/* Top bar: single project selector */}
      <div className="commits-inbox__topbar d-flex align-items-center justify-content-between flex-wrap gap-2 py-2 px-0">
        <h1 className="commits-inbox__title mb-0">Inbox</h1>
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted small me-1">Project to review:</span>
          <select
            className="form-select form-select-sm commits-inbox__repo-btn"
            style={{ maxWidth: "320px" }}
            value={selectedProjectId || ""}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
          >
            <option value="">Select a project…</option>
            {(connectedRepos || []).map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.full_name || repo.name || repo.id}
              </option>
            ))}
          </select>
          {(!connectedRepos || connectedRepos.length === 0) && (
            <span className="text-muted small">
              <Link to="/repos">Connect a repository</Link>
            </span>
          )}
        </div>
      </div>

      <div className="d-flex flex-grow-1 overflow-hidden">
        {/* Left sidebar: categories */}
        <aside className="commits-inbox__sidebar flex-shrink-0">
          <div className="commits-inbox__sidebar-inner">
            <nav className="commits-inbox__nav">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`commits-inbox__nav-item ${expandedCategory === cat.id ? "active" : ""}`}
                  onClick={() => setExpandedCategory(cat.id)}
                >
                  <span className="commits-inbox__nav-label">{cat.label}</span>
                  <span className="commits-inbox__nav-count">{cat.count ?? 0}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main: collapsible sections with commit rows */}
        <main className="commits-inbox__main flex-grow-1 overflow-auto">
          {!selectedProjectId && connectedRepos?.length === 0 ? (
            <div className="p-4 text-muted">
              No projects connected. <Link to="/repos">Connect a repository</Link> to review commits.
            </div>
          ) : !selectedProjectId ? (
            <div className="p-4 text-muted">
              Select a project to review from the dropdown above.
            </div>
          ) : loading ? (
            <div className="p-4 text-muted">Loading commits…</div>
          ) : (
            CATEGORY_IDS.map((catId) => {
              const commits = commitsByCategory[catId] || [];
              const cat = categories.find((c) => c.id === catId);
              const label = cat?.label || catId.replace(/_/g, " ");
              const isExpanded = expandedCategory === catId;

              return (
                <div key={catId} className="commits-inbox__section">
                  <button
                    type="button"
                    className="commits-inbox__section-header"
                    onClick={() => setExpandedCategory(isExpanded ? null : catId)}
                  >
                    {isExpanded ? (
                      <FaChevronDown size={12} className="me-2" />
                    ) : (
                      <FaChevronRight size={12} className="me-2" />
                    )}
                    <span className="fw-semibold">{label}</span>
                    <span className="text-muted ms-2">{commits.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="commits-inbox__section-body">
                      {commits.length === 0 ? (
                        <div className="text-muted small py-3 px-3">No commits in this category.</div>
                      ) : (
                        commits.map((commit) => (
                          <div key={commit.id} className="commits-inbox__commit-row">
                            <div className="commits-inbox__commit-title">
                              {commit.html_url ? (
                                <a href={commit.html_url} target="_blank" rel="noopener noreferrer" className="text-decoration-none" style={{ color: "var(--text-primary)" }}>
                                  {commit.title}
                                </a>
                              ) : (
                                commit.title
                              )}
                            </div>
                            <div className="commits-inbox__commit-meta">
                              {commit.owner} – {commit.repo_ref}
                            </div>
                            <div className="commits-inbox__commit-badges">
                              {commit.ci_passed > 0 && (
                                <span className="commits-inbox__ci commits-inbox__ci--pass" title="CI passed">
                                  <FaCheck size={10} /> {commit.ci_passed}
                                </span>
                              )}
                              {commit.ci_failed > 0 && (
                                <span className="commits-inbox__ci commits-inbox__ci--fail" title="CI failed">
                                  <span className="commits-inbox__dot" />
                                </span>
                              )}
                              {commit.reviewers_count > 0 && (
                                <span className="commits-inbox__reviewers">
                                  <FaUser size={10} /> {commit.reviewers_count}
                                </span>
                              )}
                              {commit.health_score != null && (
                                <span className={`commits-inbox__score ${commit.health_score >= 70 ? "commits-inbox__ci--pass" : "commits-inbox__ci--fail"}`}>
                                  Score: {commit.health_score}
                                </span>
                              )}
                              {(commit.lines_added != null || commit.lines_removed != null) && (
                                <span className="commits-inbox__diff">
                                  +{commit.lines_added ?? 0} -{commit.lines_removed ?? 0}
                                </span>
                              )}
                              {commit.age && (
                                <span className="commits-inbox__age">{commit.age}</span>
                              )}
                            </div>
                            {commit.repo_id && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary mt-1"
                                disabled={runLoading === commit.id || commit.status === "running"}
                                onClick={() => handleRunGerrit(commit.repo_id, commit.id)}
                              >
                                {runLoading === commit.id ? "Running…" :
                                 commit.status === "running" ? "In Progress…" :
                                 commit.status === "completed" ? "Re-review" : "Run Gerrit"}
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </main>
      </div>

      <style>{`
        .commits-inbox__topbar { border-bottom: 1px solid var(--border-default); }
        .commits-inbox__title { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); }
        .commits-inbox__sidebar { width: 240px; border-right: 1px solid var(--border-default); background: var(--surface-card); }
        .commits-inbox__sidebar-inner { padding: 12px; }
        .commits-inbox__add-section { font-size: 12px; padding: 4px 0; }
        .commits-inbox__nav { display: flex; flex-direction: column; gap: 2px; }
        .commits-inbox__nav-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 12px; border: none; border-radius: 6px; background: none; color: var(--text-secondary); font-size: 13px; cursor: pointer; text-align: left; }
        .commits-inbox__nav-item:hover { background: var(--sidebar-bg-hover); color: var(--text-primary); }
        .commits-inbox__nav-item.active { background: var(--sidebar-bg-active); color: var(--sidebar-accent); }
        .commits-inbox__nav-count { font-weight: 500; color: var(--text-muted); }
        .commits-inbox__main { background: var(--content-bg); padding: 16px; }
        .commits-inbox__section { margin-bottom: 8px; border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden; background: var(--surface-card); }
        .commits-inbox__section-header { display: flex; align-items: center; width: 100%; padding: 10px 12px; border: none; background: none; color: var(--text-primary); font-size: 13px; cursor: pointer; text-align: left; }
        .commits-inbox__section-header:hover { background: var(--surface-card-elevated); }
        .commits-inbox__section-body { border-top: 1px solid var(--border-default); padding: 8px; }
        .commits-inbox__commit-row { padding: 12px; border-radius: 6px; margin-bottom: 4px; background: var(--content-bg); }
        .commits-inbox__commit-row:last-child { margin-bottom: 0; }
        .commits-inbox__commit-title { font-weight: 500; color: var(--text-primary); margin-bottom: 4px; }
        .commits-inbox__commit-meta { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
        .commits-inbox__commit-badges { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: var(--text-secondary); }
        .commits-inbox__ci--pass { color: var(--color-success); }
        .commits-inbox__ci--fail { color: var(--color-danger); }
        .commits-inbox__dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--color-danger); }
        .commits-inbox__repo-btn { min-width: 180px; }
      `}</style>
    </div>
  );
}
