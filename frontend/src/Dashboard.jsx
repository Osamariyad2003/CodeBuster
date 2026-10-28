import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Alert, Spinner, Button } from 'react-bootstrap';
import {
  FaGithub,
  FaRocket,
  FaShieldAlt,
  FaHistory,
  FaBolt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaArrowRight,
  FaPlay,
  FaCodeBranch,
  FaRobot,
  FaUser,
  FaSearch
} from 'react-icons/fa';
import { useAuth } from './AuthContext';
import ProjectDropzone from './ProjectDropzone';
import ReviewResult from './ReviewResult';
import GitHubConnect from './GitHubConnect';
import RunHistory from './RunHistory';
import { useNavigate, Link } from 'react-router-dom';
import { mockReview, mockRepos, mockUser } from './mockData';
import { apiClient } from './lib/apiClient';
import { usePolling } from './hooks/usePolling';
import HealthTrendChart from './components/HealthTrendChart';
import ConfidenceBadge from './components/ConfidenceBadge';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// Modern stat tile with left accent bar, tinted icon medallion, and hover lift.
const StatTile = ({ stat, onClick }) => {
  const [hover, setHover] = useState(false);
  const interactive = Boolean(stat.link);
  return (
    <div
      className="d-flex align-items-center gap-3 h-100 cb-stat-tile"
      onClick={onClick}
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 16,
        padding: '18px 20px',
        cursor: interactive ? 'pointer' : 'default',
        boxShadow: hover
          ? '0 8px 24px -4px rgba(0, 0, 0, 0.4), 0 0 0 1px ' + stat.color + '40'
          : 'var(--shadow-sm)',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left color accent bar */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: `linear-gradient(180deg, ${stat.color}, ${stat.color}80)`,
          borderRadius: '4px 0 0 4px',
        }}
      />
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          background: stat.color + '18',
          border: '1px solid ' + stat.color + '33',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: stat.color,
          flexShrink: 0,
        }}
      >
        <stat.icon size={20} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {stat.value}
        </div>
        <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginTop: 4,
          }}
        >
          {stat.label}
        </div>
      </div>
      {interactive && hover && (
        <FaArrowRight size={12} style={{ color: stat.color, opacity: 0.8 }} />
      )}
    </div>
  );
};

// Modern action panel for GitHub Integration
const ActionPanel = ({ icon: Icon, title, subtitle, accent = '#FF570A', children }) => (
  <div
    className="h-100 d-flex flex-column cb-panel"
    style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 18,
      boxShadow: 'var(--shadow-md)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* Top accent stripe */}
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: 3,
        background: `linear-gradient(90deg, ${accent}, #FF7A30)`,
      }}
    />
    <div className="p-4 d-flex flex-column flex-grow-1">
      <div className="d-flex align-items-center gap-3 mb-3">
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: accent + '18',
            border: `1px solid ${accent}33`,
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={22} />
        </div>
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <h3 style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {title}
          </h3>
          <p className="mb-0" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [review, setReview] = useState(null);
  const [selectedRepoId, setSelectedRepoId] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);
  const [stats, setStats] = useState({
    events: 0,
    jobs: 0,
    health: 92,
    accepted_issues: 0,
    critical_issues: 0,
    avg_confidence: 0.88,
    trend: []
  });

  const fetchStats = useCallback(async () => {
    try {
      const [summaryRes, trendRes] = await Promise.all([
        apiClient.get('/api/monitoring/summary').catch(() => null),
        apiClient.get('/api/metrics/health-trend?days=7').catch(() => null)
      ]);

      if (summaryRes) {
        const trendData = Array.isArray(trendRes) ? trendRes : (summaryRes?.trend || []);
        setStats({
          events: summaryRes.events || 0,
          jobs: summaryRes.jobs || 0,
          health: summaryRes.health || 92,
          accepted_issues: summaryRes.accepted_issues || 0,
          critical_issues: summaryRes.critical_issues || 0,
          avg_confidence: summaryRes.avg_confidence || 0.88,
          trend: trendData
        });
      } else if (USE_MOCK_DATA) {
        setStats({
          events: 12,
          jobs: 3,
          health: 88,
          accepted_issues: 42,
          critical_issues: 5,
          avg_confidence: 0.88,
          trend: [
            { date: 'Mon', score: 82 },
            { date: 'Tue', score: 84 },
            { date: 'Wed', score: 83 },
            { date: 'Thu', score: 85 },
            { date: 'Fri', score: 88 },
            { date: 'Sat', score: 85 },
            { date: 'Sun', score: 88 },
          ]
        });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  }, []);

  const { refetch } = usePolling(fetchStats, { key: 'dashboard-summary' });

  // Fetch real repositories from API, with fallback to mock data only if none connected
  useEffect(() => {
    const fetchRepos = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get('/api/repos');
        if (data && Array.isArray(data.repos) && data.repos.length > 0) {
          setRepos(data.repos);
          setSelectedRepoId(prev => prev || data.repos[0].id);
        } else if (USE_MOCK_DATA) {
          setRepos(mockRepos);
          setReview(mockReview);
          setSelectedRepoId(prev => prev || (mockRepos[0] ? mockRepos[0].id : null));
        } else {
          setRepos([]);
        }
      } catch (err) {
        if (err?.response?.status === 401 || err?.status === 401) {
          logout();
          navigate('/', { replace: true });
          return;
        }
        console.error('Error fetching repos:', err);
        if (USE_MOCK_DATA) {
          setRepos(mockRepos);
          setReview(mockReview);
        } else {
          setError(err?.message || 'Failed to load repositories');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, [logout, navigate]);

  // When selected repository changes, fetch its latest review
  useEffect(() => {
    if (!selectedRepoId) return;

    const fetchLatestReview = async () => {
      try {
        const rev = await apiClient.get(`/api/repos/${selectedRepoId}/latest-review`);
        if (rev && (rev.id || rev.review || rev.health_score !== undefined)) {
          setReview(rev.review || rev);
        } else if (USE_MOCK_DATA && repos === mockRepos) {
          setReview(mockReview);
        } else {
          setReview(null);
        }
      } catch (err) {
        if (USE_MOCK_DATA && repos === mockRepos) {
          setReview(mockReview);
        } else {
          setReview(null);
        }
      }
    };

    fetchLatestReview();
  }, [selectedRepoId, repos]);

  const handleTriggerScan = async () => {
    if (!selectedRepoId) return;
    setIsScanning(true);
    setScanMessage(null);
    try {
      const res = await apiClient.post(`/api/repos/${selectedRepoId}/scan`);
      setScanMessage({
        type: 'success',
        text: res.message || 'AI Review Scan initiated! Analyzing Abstract Syntax Tree and security surface...'
      });

      // Refetch latest review and metrics after a short interval
      setTimeout(async () => {
        try {
          const rev = await apiClient.get(`/api/repos/${selectedRepoId}/latest-review`);
          if (rev && (rev.id || rev.review)) {
            setReview(rev.review || rev);
          }
        } catch (_) {}
        fetchStats();
        setIsScanning(false);
      }, 2500);
    } catch (err) {
      setScanMessage({ type: 'danger', text: err?.message || 'Failed to trigger scan' });
      setIsScanning(false);
    }
  };

  const handleSelectReview = async (historyReview) => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/api/reviews/${historyReview.id}`);
      setReview(data);
      document.getElementById('quality')?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to load review:', err);
    } finally {
      setLoading(false);
    }
  };

  const displayUser = user || (USE_MOCK_DATA ? mockUser : { login: 'Developer', name: 'Developer' });
  const selectedRepo = repos.find(r => r.id === selectedRepoId) || repos[0];

  return (
    <Container className="py-4" style={{ maxWidth: 1200 }}>
      {/* Overview Hero Section */}
      <div
        id="overview"
        className="mb-4 p-4 position-relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--surface-card) 0%, var(--surface-card-elevated) 100%)',
          border: '1px solid rgba(255, 87, 10, 0.22)',
          borderRadius: 20,
          boxShadow: '0 20px 50px -15px rgba(0, 0, 0, 0.5), 0 0 35px -10px rgba(255, 87, 10, 0.12)',
        }}
      >
        {/* Subtle decorative glow */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 280,
            height: 280,
            background: 'radial-gradient(circle, rgba(255, 87, 10, 0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3 position-relative">
          <div className="d-flex align-items-center gap-3">
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #FF570A 0%, #FF7A30 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 8px 24px rgba(255, 87, 10, 0.35)',
                flexShrink: 0,
              }}
            >
              <FaRocket size={24} />
            </div>
            <div>
              <h1
                className="mb-1"
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.025em',
                }}
              >
                Dashboard
              </h1>
              <div className="d-flex align-items-center flex-wrap gap-2" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <span>
                  Welcome back,{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {displayUser?.name || displayUser?.login || 'Developer'}
                  </strong>
                </span>
                <span
                  className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill"
                  style={{
                    background: 'rgba(37, 226, 168, 0.12)',
                    color: '#25E2A8',
                    border: '1px solid rgba(37, 226, 168, 0.28)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#25E2A8',
                      boxShadow: '0 0 6px #25E2A8',
                    }}
                  />
                  AI Senior Reviewer Active (Gemini 2.5 Flash)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Repository Switcher */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {repos.length > 0 && (
              <div className="d-flex align-items-center gap-2">
                <span className="small text-secondary fw-semibold d-none d-sm-inline">
                  <FaCodeBranch size={12} className="me-1" /> Repo:
                </span>
                <select
                  className="form-select form-select-sm"
                  style={{
                    minWidth: 180,
                    maxWidth: 260,
                    background: 'var(--surface-card)',
                    color: 'var(--text-primary)',
                    borderColor: 'var(--border-default)',
                    borderRadius: 10,
                    fontWeight: 600
                  }}
                  value={selectedRepoId || ''}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                >
                  {repos.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.full_name || r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              className="cb-btn cb-btn--primary cb-btn--sm"
              onClick={handleTriggerScan}
              disabled={isScanning || !selectedRepoId}
              style={{
                background: '#FF570A',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                boxShadow: '0 4px 14px rgba(255, 87, 10, 0.35)'
              }}
            >
              {isScanning ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" /> Scanning AST...
                </>
              ) : (
                <>
                  <FaPlay size={11} className="me-1" /> Run AI Review Scan
                </>
              )}
            </Button>

            <Link
              to="/repos/search"
              className="btn btn-sm btn-outline-secondary d-none d-md-inline-flex align-items-center gap-1"
              style={{ borderRadius: 10, fontWeight: 600 }}
            >
              <FaSearch size={11} /> Connect Repo
            </Link>

            <Link
              to="/profile"
              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
              style={{ borderRadius: 10, fontWeight: 600 }}
              title="Open AI Preferences & Profile"
            >
              <FaUser size={11} />
            </Link>
          </div>
        </div>

        {scanMessage && (
          <Alert
            variant={scanMessage.type}
            dismissible
            onClose={() => setScanMessage(null)}
            className="mb-3"
            style={{
              background: scanMessage.type === 'success' ? 'rgba(37, 226, 168, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              borderColor: scanMessage.type === 'success' ? '#25E2A8' : '#EF4444',
              color: 'var(--text-primary)',
              borderRadius: 12
            }}
          >
            {scanMessage.text}
          </Alert>
        )}

        {/* Stats Summary Row */}
        <Row className="mt-3 g-3" id="performance">
          {[
            { label: 'Health Score', value: stats.health + '%', color: '#25E2A8', icon: FaShieldAlt },
            { label: 'Avg Confidence', value: <ConfidenceBadge score={stats.avg_confidence} />, color: '#687FF5', icon: FaShieldAlt },
            { label: 'Accepted Issues', value: stats.accepted_issues, color: '#FF570A', icon: FaCheckCircle, link: '/issues?status=accepted' },
            { label: 'Critical Issues', value: stats.critical_issues, color: '#EF4444', icon: FaExclamationTriangle, link: '/issues?severity=critical' },
            { label: 'Recent Events', value: stats.events, color: '#25E2A8', icon: FaBolt, link: '/events' },
            { label: 'Active Jobs', value: stats.jobs, color: '#F59E0B', icon: FaHistory, link: '/jobs' }
          ].map((stat, i) => (
            <Col key={i} xs={12} md={6} lg={4}>
              <StatTile stat={stat} onClick={() => stat.link && navigate(stat.link)} />
            </Col>
          ))}
        </Row>

        {/* Health Trend Chart Container */}
        <div
          className="mt-4 p-4"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="d-flex justify-content-between align-items-baseline mb-3 flex-wrap gap-2">
            <div>
              <h4 className="fw-bold mb-0" style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                Repository Health Trajectory
              </h4>
              <span className="small text-secondary">
                {selectedRepo?.full_name ? `Tracking AST code health for ${selectedRepo.full_name}` : '7-Day Code Quality & Security Metric'}
              </span>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Last 7 Days
            </span>
          </div>
          <HealthTrendChart data={stats.trend} />
        </div>
      </div>

      {/* Action Cards */}
      <Row className="g-3 mb-4">
        <Col md={12}>
          <ActionPanel
            icon={FaGithub}
            title="GitHub Integration & Repository Bridge"
            subtitle="Connect repositories for automated webhooks and inline PR fixes"
            accent="#FF570A"
          >
            <GitHubConnect />
          </ActionPanel>
        </Col>
      </Row>

      {/* Review Results Section */}
      {review ? (
        <div id="quality" className="mb-4">
          <div className="d-flex align-items-center gap-2 mb-3">
            <div
              aria-hidden
              style={{
                width: 4,
                height: 22,
                background: 'linear-gradient(180deg, #FF570A, #25E2A8)',
                borderRadius: 2,
              }}
            />
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              Latest AI Review Findings
            </h2>
            <span
              style={{
                background: 'rgba(255, 87, 10, 0.15)',
                color: '#FF570A',
                border: '1px solid rgba(255, 87, 10, 0.3)',
                padding: '2px 8px',
                borderRadius: 9999,
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              {review.pr_number ? `PR #${review.pr_number}` : 'Autonomous AST Review'}
            </span>
            {selectedRepo?.full_name && (
              <span className="text-secondary small ms-2">
                on {selectedRepo.full_name}
              </span>
            )}
          </div>
          <ReviewResult review={review} />
        </div>
      ) : selectedRepoId ? (
        <div
          className="mb-4 p-5 text-center"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 18,
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'rgba(255, 87, 10, 0.12)',
              color: '#FF570A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <FaRocket size={26} />
          </div>
          <h4 className="fw-bold text-white mb-2">Ready for AST Code Review</h4>
          <p className="text-secondary small mb-4" style={{ maxWidth: 480, margin: '0 auto 1.5rem' }}>
            No previous review runs recorded for <strong>{selectedRepo?.full_name || 'this repository'}</strong> yet. Trigger a scan now to analyze code quality, security posture, and 1-click fixes.
          </p>
          <Button
            className="cb-btn cb-btn--primary"
            onClick={handleTriggerScan}
            disabled={isScanning}
            style={{
              background: '#FF570A',
              border: 'none',
              padding: '10px 24px',
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            {isScanning ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" /> Analyzing Repository...
              </>
            ) : (
              <>
                <FaPlay size={13} className="me-2" /> Run Initial AI Scan
              </>
            )}
          </Button>
        </div>
      ) : null}

      {/* Run History Section */}
      {repos?.length > 0 && (
        <div
          className="mb-4 p-4"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 18,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <RunHistory
            repositoryId={selectedRepoId || repos[0]?.id}
            onSelectReview={handleSelectReview}
          />
        </div>
      )}
    </Container>
  );
};

export default Dashboard;
