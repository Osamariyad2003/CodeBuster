import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  Row,
  Spinner,
  Tab,
  Tabs,
} from "react-bootstrap";
import {
  FaExternalLinkAlt,
  FaStar,
  FaSearch,
  FaArrowLeft,
  FaGithub,
  FaChevronLeft,
  FaChevronRight,
  FaCheckCircle,
  FaPlus,
  FaCodeBranch,
} from "react-icons/fa";
import { useAuth } from "../AuthContext";
import { useToast } from "../components/ToastProvider";
import { apiClient, triggerScan } from "../lib/apiClient";
import {
  searchInstalledRepos,
  searchPublicRepos,
  InstalledReposResponse,
  PublicReposResponse,
  GithubSearchItem,
} from "../api/githubSearch";

const PER_PAGE = 20;

type TabKey = "installed" | "public";

export default function SearchRepositoriesPage() {
  const navigate = useNavigate();
  const { connectedRepos, connectRepo } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get("tab") as TabKey) || "installed";
  const query = searchParams.get("q") || "";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));

  const [debouncedQuery, setDebouncedQuery] = useState(query);

  const [installedState, setInstalledState] = useState<{
    loading: boolean;
    error: string | null;
    data: InstalledReposResponse | null;
  }>({
    loading: false,
    error: null,
    data: null,
  });

  const [publicState, setPublicState] = useState<{
    loading: boolean;
    error: string | null;
    data: PublicReposResponse | null;
  }>({
    loading: false,
    error: null,
    data: null,
  });

  const [scanningRepoId, setScanningRepoId] = useState<string | null>(null);
  // full_name of the source repo currently being forked (so we can show a per-card spinner)
  const [forkingFullName, setForkingFullName] = useState<string | null>(null);
  // After a successful fork, we poll the Installed list waiting for it to land.
  // Holds the expected `owner/name` of the fork (e.g. "Osamariyad2003/is").
  const [pendingFork, setPendingFork] = useState<string | null>(null);

  // Debounce the actual search query used for network calls
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  // After a successful fork, poll the installed-repos endpoint up to ~20s
  // waiting for the new fork to surface. As soon as we see it, toast and
  // clear the pending state. If we time out, tell the user to refresh.
  useEffect(() => {
    if (!pendingFork) return;
    let cancelled = false;
    const start = Date.now();
    const MAX_MS = 20_000;
    const INTERVAL_MS = 2_000;

    const tick = async () => {
      if (cancelled) return;
      try {
        // Search by basename so the response is small even on big installs
        const basename = pendingFork.split("/")[1] || pendingFork;
        const res = await searchInstalledRepos({
          query: basename,
          page: 1,
          per_page: PER_PAGE,
        });
        const items = res?.items || [];
        const found = items.find(
          (it) => (it.full_name || "").toLowerCase() === pendingFork.toLowerCase()
        );
        if (cancelled) return;
        if (found) {
          // Refresh the visible installed list with what we just fetched so the
          // fork shows up immediately without an extra round-trip.
          setInstalledState({ loading: false, error: null, data: res });
          showToast(`Fork ready: ${pendingFork}`, "success");
          setPendingFork(null);
          return;
        }
      } catch {
        // ignore — keep polling until timeout
      }
      if (Date.now() - start > MAX_MS) {
        if (!cancelled) {
          showToast(
            `Fork is taking longer than usual. Refresh the page — it should appear shortly.`,
            "warning"
          );
          setPendingFork(null);
        }
        return;
      }
      setTimeout(tick, INTERVAL_MS);
    };

    // First check after 1.5s — gives GitHub a head-start on the async fork
    const handle = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFork]);

  // Connected repos by full_name for CTA logic
  const connectedByFullName = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of connectedRepos || []) {
      map.set(r.full_name, r);
    }
    return map;
  }, [connectedRepos]);

  // Fetch installed repos when tab is active
  useEffect(() => {
    if (tab !== "installed") return;

    let cancelled = false;
    setInstalledState((prev) => ({ ...prev, loading: true, error: null }));

    searchInstalledRepos({ query: debouncedQuery, page, per_page: PER_PAGE })
      .then((res) => {
        if (cancelled) return;
        setInstalledState({ loading: false, error: null, data: res });
      })
      .catch((err: any) => {
        if (cancelled) return;
        const msg =
          err?.userMessage ||
          err?.message ||
          "Failed to search installed repositories.";
        setInstalledState((prev) => ({ ...prev, loading: false, error: msg }));
      });

    return () => {
      cancelled = true;
    };
  }, [tab, debouncedQuery, page]);

  // Fetch public repos when tab is active
  useEffect(() => {
    if (tab !== "public") return;

    let cancelled = false;
    setPublicState((prev) => ({ ...prev, loading: true, error: null }));

    if (!debouncedQuery) {
      // Empty query -> no results, but do not hit GitHub
      setPublicState({
        loading: false,
        error: null,
        data: {
          items: [],
          page,
          per_page: PER_PAGE,
          total_count: 0,
          source: "public",
        },
      });
      return;
    }

    searchPublicRepos({ query: debouncedQuery, page, per_page: PER_PAGE })
      .then((res) => {
        if (cancelled) return;
        setPublicState({ loading: false, error: null, data: res });
      })
      .catch((err: any) => {
        if (cancelled) return;
        const msg =
          err?.userMessage ||
          err?.message ||
          "Failed to search public repositories.";
        setPublicState((prev) => ({ ...prev, loading: false, error: msg }));
      });

    return () => {
      cancelled = true;
    };
  }, [tab, debouncedQuery, page]);

  const handleTabChange = (next: string | null) => {
    const nextTab: TabKey = next === "public" ? "public" : "installed";
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", nextTab);
    sp.set("page", "1");
    setSearchParams(sp);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const sp = new URLSearchParams(searchParams);
    if (value) {
      sp.set("q", value);
    } else {
      sp.delete("q");
    }
    sp.set("page", "1");
    setSearchParams(sp);
  };

  const handlePageChange = (nextPage: number) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("page", String(Math.max(1, nextPage)));
    setSearchParams(sp);
  };

  const handleConnect = async (item: GithubSearchItem) => {
    if (!item.full_name || !item.id || !item.installation_id) return;
    try {
      const res = await connectRepo(
        item.full_name,
        item.id,
        item.installation_id
      );
      if (res?.success && res.repo_id) {
        navigate(`/repos/${res.repo_id}`, {
          state: { justConnected: true, repoFullName: item.full_name },
        });
      }
    } catch (err) {
      // Errors are already surfaced globally by apiClient; no-op here.
      console.error("Connect repo failed", err);
      showToast("Failed to connect repository", "danger");
    }
  };

  const handleRequestReview = async (connectedRepo: any) => {
    if (!connectedRepo?.id) return;
    try {
      setScanningRepoId(connectedRepo.id);
      const res = await triggerScan(connectedRepo.id, {});
      if (!res?.success) {
        showToast(res?.error || "Failed to request review", "danger");
        return;
      }
      showToast(
        "Review requested. We’ll run a scan and update the repository dashboard.",
        "success"
      );
      navigate(`/repos/${connectedRepo.id}`);
    } catch (err: any) {
      const msg = err?.userMessage || err?.message || "Failed to request review";
      showToast(msg, "danger");
    } finally {
      setScanningRepoId(null);
    }
  };

  const handleFork = async (sourceFullName: string) => {
    if (!sourceFullName || forkingFullName) return;
    try {
      setForkingFullName(sourceFullName);
      // skipAuthHandler: a 401 from /github/fork means "the OAuth token
      // for THIS feature is missing", not "your session expired" — show
      // only our specific toast, not the global signed-out toast.
      const res = await apiClient.post(
        "/github/fork",
        { source_full_name: sourceFullName },
        { skipAuthHandler: true } as any
      );
      if (!res?.success) {
        showToast(res?.error || "Fork failed", "danger");
        return;
      }
      const forkName = res.fork_full_name || `your-account/${sourceFullName.split("/")[1]}`;
      showToast(
        res.pending
          ? `Forking ${sourceFullName} → ${forkName} (locating it now…)`
          : `Forked to ${forkName}`,
        "success"
      );
      // Switch to the Installed tab so the user can pick up the fork once GitHub
      // surfaces it. We also pre-fill the search with the repo basename so it's
      // easy to spot.
      const repoBasename = sourceFullName.split("/")[1] || "";
      const sp = new URLSearchParams(searchParams);
      sp.set("tab", "installed");
      sp.set("page", "1");
      if (repoBasename) sp.set("q", repoBasename);
      setSearchParams(sp);

      // Kick off polling so the fork appears the instant GitHub publishes it.
      if (res.fork_full_name) {
        setPendingFork(res.fork_full_name);
      }
    } catch (err: any) {
      const msg = err?.userMessage || err?.message || "Fork failed";
      showToast(msg, "danger");
    } finally {
      setForkingFullName(null);
    }
  };

  const handleConnectFromPublic = async (repoFullName?: string) => {
    try {
      if (repoFullName) {
        localStorage.setItem("cb_pending_repo_full_name", repoFullName);
      }
      const data = await apiClient.get("/api/github/install-url");
      if (data?.url) {
        window.location.href = data.url;
      } else {
        showToast("Failed to get GitHub App installation URL", "danger");
      }
    } catch {
      showToast("Failed to start GitHub connection", "danger");
    }
  };

  const activeState = tab === "installed" ? installedState : publicState;
  const activeData = activeState.data;

  const total = (() => {
    if (!activeData) return 0;
    if (tab === "installed") {
      return (activeData as InstalledReposResponse).total_estimate;
    }
    return (activeData as PublicReposResponse).total_count;
  })();

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE || 1));

  const renderRepoCard = (item: GithubSearchItem) => {
    const connected = connectedByFullName.get(item.full_name);

    const handleCardClick = () => {
      if (tab !== "installed") return;
      if (connected) {
        navigate(`/repos/${connected.id}`);
      } else {
        void handleConnect(item);
      }
    };

    return (
      <div
        key={`${item.id}-${item.full_name}`}
        className="p-3 mb-3 d-flex align-items-start gap-3"
        onClick={handleCardClick}
        style={{
          background: "white",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
          cursor: tab === "installed" ? "pointer" : "default",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (tab !== "installed") return;
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.06)";
        }}
        onMouseLeave={(e) => {
          if (tab !== "installed") return;
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.02)";
        }}
      >
        {/* GitHub icon chip */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: connected ? "rgba(5, 150, 105, 0.1)" : "#F3F4F6",
            color: connected ? "#059669" : "#374151",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <FaGithub size={16} />
        </div>

        {/* Body */}
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span
              className="fw-semibold text-truncate"
              style={{ color: "#111827", fontSize: "0.95rem" }}
              title={item.full_name}
            >
              {item.full_name}
            </span>
            {connected && (
              <Badge bg="success" className="d-inline-flex align-items-center" style={{ gap: 4 }}>
                <FaCheckCircle size={9} /> Connected
              </Badge>
            )}
            {item.language && (
              <Badge bg="light" text="dark" pill style={{ fontSize: "0.7rem" }}>
                {item.language}
              </Badge>
            )}
          </div>
          {item.description && (
            <div
              className="text-muted small mb-2 text-truncate"
              style={{ maxWidth: 560 }}
              title={item.description}
            >
              {item.description}
            </div>
          )}
          <div className="d-flex align-items-center gap-3 text-muted" style={{ fontSize: "0.78rem" }}>
            <span className="d-inline-flex align-items-center gap-1">
              <FaStar size={10} /> {item.stargazers_count ?? 0}
            </span>
            {item.updated_at && (
              <span>
                Updated{" "}
                {new Date(item.updated_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="d-flex flex-column align-items-end gap-2 ms-2 flex-shrink-0">
          <Button
            as="a"
            href={item.html_url}
            target="_blank"
            rel="noreferrer"
            variant="outline-secondary"
            size="sm"
            onClick={(e) => e.stopPropagation()}
            className="d-flex align-items-center"
          >
            <FaExternalLinkAlt size={10} className="me-1" /> GitHub
          </Button>
          {tab === "public" && (
            <>
              {/*
                Fork lands the repo under the user's account; if their CodeBuster
                install covers "All repositories", it becomes reviewable on the
                Installed tab without any extra GitHub install step.
               */}
              <Button
                variant="primary"
                size="sm"
                disabled={forkingFullName === item.full_name || connected}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFork(item.full_name);
                }}
                title={
                  connected
                    ? "Already connected"
                    : "Fork this repo to your account so CodeBuster can review it"
                }
                className="d-flex align-items-center"
              >
                {forkingFullName === item.full_name ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Forking…
                  </>
                ) : (
                  <>
                    <FaCodeBranch size={11} className="me-1" /> Fork & review
                  </>
                )}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="text-muted text-decoration-none p-0"
                style={{ fontSize: "0.75rem" }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleConnectFromPublic(item.full_name);
                }}
              >
                Or install on GitHub
              </Button>
            </>
          )}
          {tab === "installed" && (
            <>
              {connected ? (
                <>
                  <Button
                    as={Link}
                    to={`/repos/${connected.id}`}
                    variant="primary"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open in CodeBuster
                  </Button>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    disabled={scanningRepoId === connected.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequestReview(connected);
                    }}
                  >
                    {scanningRepoId === connected.id ? (
                      <><Spinner size="sm" animation="border" className="me-2" />Requesting…</>
                    ) : (
                      "Request review"
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConnect(item);
                  }}
                  disabled={!item.installation_id}
                >
                  Connect & review
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderSkeleton = () => {
    return (
      <>
        {[0, 1, 2].map((i) => (
          <Card key={i} className="mb-3">
            <Card.Body>
              <div className="placeholder-glow">
                <span className="placeholder col-6 mb-2" />
                <span className="placeholder col-9 mb-1" />
                <span className="placeholder col-4" />
              </div>
            </Card.Body>
          </Card>
        ))}
      </>
    );
  };

  return (
    <Container className="py-4" style={{ maxWidth: 1100 }}>
      {/* Back link */}
      <Link
        to="/repos"
        className="d-inline-flex align-items-center text-muted text-decoration-none small mb-3"
        style={{ gap: 6 }}
      >
        <FaArrowLeft size={11} /> Back to repositories
      </Link>

      {/* Header */}
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          <h4 className="mb-1 fw-bold" style={{ color: "#111827" }}>
            Connect a repository
          </h4>
          <div className="text-muted small" style={{ maxWidth: 600 }}>
            Search repos already installed for your GitHub App, or browse all of GitHub.
            "Connect" starts the permission flow on GitHub.
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => handleConnectFromPublic()}
          className="d-flex align-items-center"
        >
          <FaPlus size={11} className="me-2" />
          Install GitHub App
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={tab}
        onSelect={handleTabChange}
        className="mb-3"
      >
        <Tab eventKey="installed" title={<span><FaCheckCircle size={11} className="me-2" />Installed</span>} />
        <Tab eventKey="public" title={<span><FaGithub size={11} className="me-2" />Public GitHub</span>} />
      </Tabs>

      {/* Search bar with icon */}
      <div className="mb-3" style={{ maxWidth: 560 }}>
        <div
          className="d-flex align-items-center px-3"
          style={{
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
          }}
        >
          <FaSearch size={12} className="text-muted me-2 flex-shrink-0" />
          <Form.Control
            type="search"
            placeholder={
              tab === "installed"
                ? "Search repositories installed for your GitHub App…"
                : "Search public GitHub repositories…"
            }
            value={query}
            onChange={handleQueryChange}
            className="border-0 px-0"
            style={{ boxShadow: "none", background: "transparent" }}
          />
        </div>
      </div>

      {activeState.error && (
        <Alert variant="danger" className="mb-3">
          <Alert.Heading>Search problem</Alert.Heading>
          <p className="mb-0">
            {activeState.error}{" "}
            {tab === "public"
              ? "If this keeps happening, wait a minute to avoid GitHub rate limits, then try again."
              : "Please refresh the page or try again. If the problem persists, reconnect your GitHub App installation."}
          </p>
        </Alert>
      )}

      {/* Live status while we're polling GitHub for a freshly-created fork */}
      {pendingFork && tab === "installed" && (
        <div
          className="d-flex align-items-center gap-3 px-3 py-2 mb-3"
          style={{
            background: "rgba(79, 70, 229, 0.04)",
            border: "1px solid rgba(79, 70, 229, 0.18)",
            borderRadius: 10,
          }}
        >
          <Spinner size="sm" animation="border" style={{ color: "#4F46E5" }} />
          <div className="flex-grow-1 small" style={{ color: "#374151" }}>
            Locating your fork <strong>{pendingFork}</strong>… this usually
            takes a few seconds.
          </div>
          <Button
            variant="link"
            size="sm"
            className="text-muted text-decoration-none p-0"
            onClick={() => setPendingFork(null)}
          >
            Cancel
          </Button>
        </div>
      )}

      {activeState.loading && !activeData && renderSkeleton()}

      {!activeState.loading && activeData && activeData.items.length === 0 && (
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
            <FaSearch size={20} />
          </div>
          <h6 className="fw-semibold mb-2">
            {tab === "installed"
              ? "No installed repos match"
              : debouncedQuery
              ? "No public results"
              : "Search public GitHub"}
          </h6>
          <p className="text-muted small mb-0" style={{ maxWidth: 360, marginInline: "auto" }}>
            {tab === "installed"
              ? "Try a different search term, or install the GitHub App on more repos."
              : debouncedQuery
              ? "Try a different search term."
              : "Type a query above to discover repositories on GitHub."}
          </p>
        </div>
      )}

      {!activeState.loading && activeData && activeData.items.length > 0 && (
        <>
          {activeData.items.map(renderRepoCard)}

          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted small">
                Showing page <strong>{page}</strong> of {totalPages} · {total.toLocaleString()} results
              </span>
              <div className="d-flex align-items-center gap-2">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="d-flex align-items-center"
                >
                  <FaChevronLeft size={10} className="me-1" /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  className="d-flex align-items-center"
                >
                  Next <FaChevronRight size={10} className="ms-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {activeState.loading && activeData && (
        <div className="d-flex align-items-center gap-2 mt-3 text-muted small">
          <Spinner animation="border" size="sm" /> Updating results…
        </div>
      )}
    </Container>
  );
}

