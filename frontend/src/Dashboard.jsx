import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { FaGithub, FaCloudUploadAlt, FaRocket, FaShieldAlt, FaHistory, FaBolt, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from './AuthContext';
import ProjectDropzone from './ProjectDropzone';
import ReviewResult from './ReviewResult';
import GitHubConnect from './GitHubConnect';
import RunHistory from './RunHistory';
import { useNavigate } from 'react-router-dom';
import { mockReview, mockRepos, mockUser } from './mockData';
import { apiClient } from './lib/apiClient';
import { usePolling } from './hooks/usePolling';
import HealthTrendChart from './components/HealthTrendChart';
import ConfidenceBadge from './components/ConfidenceBadge';


const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// Premium stat tile with left accent bar, tinted icon medallion, and hover lift.
// Splits state per-tile so hovering one doesn't re-render the whole row.
const StatTile = ({ stat, onClick }) => {
  const [hover, setHover] = useState(false);
  const interactive = Boolean(stat.link);
  return (
    <div
      className="d-flex align-items-center gap-3 h-100"
      onClick={onClick}
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        padding: '16px 18px',
        cursor: interactive ? 'pointer' : 'default',
        boxShadow: hover
          ? '0 6px 20px rgba(0, 0, 0, 0.06)'
          : '0 1px 2px rgba(0, 0, 0, 0.02)',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
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
          width: 3,
          background: stat.color,
        }}
      />
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: stat.color + '15',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: stat.color,
          flexShrink: 0,
        }}
      >
        <stat.icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color, lineHeight: 1.1 }}>
          {stat.value}
        </div>
        <div
          style={{
            fontSize: '0.7rem',
            color: '#6B7280',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginTop: 4,
          }}
        >
          {stat.label}
        </div>
      </div>
    </div>
  );
};

// Premium action panel shared by Local Upload and GitHub Integration cards.
// Has a left accent bar, tinted icon medallion, and matches the polish on
// the rest of the app.
const ActionPanel = ({ icon: Icon, title, subtitle, accent = '#4F46E5', children }) => (
  <div
    className="h-100 d-flex flex-column"
    style={{
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: 14,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
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
        background: accent,
      }}
    />
    <div className="p-4 d-flex flex-column flex-grow-1">
      <div className="d-flex align-items-center gap-3 mb-3">
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: accent + '15',
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
          <h3 style={{ fontWeight: 700, fontSize: '1.05rem', margin: 0, color: '#111827' }}>
            {title}
          </h3>
          <p className="mb-0" style={{ fontSize: '0.85rem', color: '#6B7280' }}>
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
  const [stats, setStats] = useState({
    events: 0,
    jobs: 0,
    health: 85,
    accepted_issues: 0,
    critical_issues: 0,
    avg_confidence: 0,
    trend: []
  });

  const fetchStats = useCallback(async () => {
    try {
      if (USE_MOCK_DATA) {
        setStats({
          events: 12,
          jobs: 3,
          health: 85,
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
            { date: 'Sun', score: 85 },
          ]
        });
        return;
      }
      // Promise.all to fetch both summary and trend (apiClient returns response body)
      const [summaryRes, trendRes] = await Promise.all([
        apiClient.get('/api/monitoring/summary'),
        apiClient.get('/api/metrics/health-trend?days=7')
      ]);

      setStats({
        ...summaryRes,
        trend: Array.isArray(trendRes) ? trendRes : (summaryRes?.trend || [])
      });
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  }, []);

  const { lastUpdated, refetch } = usePolling(fetchStats, { key: 'dashboard-summary' });

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        setLoading(true);

        if (USE_MOCK_DATA) {
          setTimeout(() => {
            setRepos(mockRepos);
            setReview(mockReview);
            setLoading(false);
          }, 500);
          return;
        }

        const data = await apiClient.get('/api/repos');
        if (data && data.repos) {
          setRepos(data.repos);
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
        setError(err?.message || 'Failed to load repositories');
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, [logout, navigate]);

  useEffect(() => {
    if (repos?.length > 0 && !selectedRepoId) {
      setSelectedRepoId(repos[0].id);
    }
  }, [repos, selectedRepoId]);

  const handleReviewComplete = (review, files, detailedReview) => {
    console.log('Review complete:', review);
    setReview(detailedReview || review);
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

  const displayUser = USE_MOCK_DATA ? mockUser : user;

  return (
    <>
      <Container className="py-5" style={{ maxWidth: 1200 }}>
        {/* Overview Section */}
        <div
          id="overview"
          className="mb-5 p-4"
          style={{
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 14,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div className="d-flex align-items-center gap-3 mb-1">
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #4F46E5, #06B6D4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 6px 18px rgba(79, 70, 229, 0.25)',
                flexShrink: 0,
              }}
            >
              <FaRocket size={20} />
            </div>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <h1
                className="mb-1"
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#111827',
                  letterSpacing: '-0.02em',
                }}
              >
                Dashboard
              </h1>
              <p className="mb-0 d-flex align-items-center flex-wrap" style={{ color: '#6B7280', fontSize: '0.9rem', gap: 6 }}>
                Welcome back,{' '}
                <strong style={{ color: '#111827' }}>
                  {displayUser?.name || displayUser?.login || 'Developer'}
                </strong>
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#10B981',
                    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.18)',
                    marginLeft: 4,
                  }}
                />
                <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
                  All systems operational
                </span>
              </p>
            </div>
          </div>

          {/* Stats Summary */}
          <Row className="mt-4 g-3" id="performance">
            {[
              { label: 'Health Score', value: stats.health + '%', color: '#059669', icon: FaShieldAlt },
              { label: 'Avg Confidence', value: <ConfidenceBadge score={stats.avg_confidence} />, color: '#0EA5E9', icon: FaShieldAlt },
              { label: 'Accepted Issues', value: stats.accepted_issues, color: '#4F46E5', icon: FaCheckCircle, link: '/issues?status=accepted' },
              { label: 'Critical Issues', value: stats.critical_issues, color: '#DC2626', icon: FaExclamationTriangle, link: '/issues?severity=critical' },
              { label: 'Recent Events', value: stats.events, color: '#0EA5E9', icon: FaBolt, link: '/events' },
              { label: 'Active Jobs', value: stats.jobs, color: '#F59E0B', icon: FaHistory, link: '/jobs' }
            ].map((stat, i) => (
              <Col key={i} xs={12} md={6} lg={4}>
                <StatTile stat={stat} onClick={() => stat.link && navigate(stat.link)} />
              </Col>
            ))}
          </Row>

          {/* Trend Chart */}
          <div
            className="mt-4 p-4"
            style={{
              background: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: 12,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            }}
          >
            <div className="d-flex justify-content-between align-items-baseline mb-3 flex-wrap gap-2">
              <h4 className="fw-bold mb-0" style={{ fontSize: '1.05rem', color: '#111827' }}>
                Health Trend
              </h4>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: '#6B7280',
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
        <Row className="g-3 mb-5">
          <Col md={12}>
            <ActionPanel
              icon={FaGithub}
              title="GitHub Integration"
              subtitle="Connect repositories for automated reviews"
              accent="#0D9488"
            >
              <GitHubConnect />
            </ActionPanel>
          </Col>
        </Row>

        {/* Run History Section */}
        {repos?.length > 0 && (
          <div
            className="mb-5 p-4"
            style={{
              background: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: 14,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            }}
          >
            <RunHistory
              repositoryId={selectedRepoId || repos[0]?.id}
              onSelectReview={handleSelectReview}
            />
          </div>
        )}

        {/* Review Results Section */}
        {review && (
          <div id="quality" className="mt-5">
            <div className="d-flex align-items-center gap-2 mb-3">
              <div
                aria-hidden
                style={{
                  width: 4,
                  height: 22,
                  background: 'linear-gradient(180deg, #4F46E5, #06B6D4)',
                  borderRadius: 2,
                }}
              />
              <h2
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  margin: 0,
                  color: '#111827',
                  letterSpacing: '-0.01em',
                }}
              >
                Review Findings
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#6B7280',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginLeft: 6,
                }}
              >
                {review.pr_number ? `PR #${review.pr_number}` : 'Manual Scan'}
              </span>
            </div>
            <ReviewResult review={review} />
          </div>
        )}
      </Container>
    </>
  );
};

export default Dashboard;
