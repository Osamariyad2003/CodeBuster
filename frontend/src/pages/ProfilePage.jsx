import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spinner, Alert } from 'react-bootstrap';
import {
  FaUser,
  FaRobot,
  FaCodeBranch,
  FaShieldAlt,
  FaBell,
  FaSave,
  FaGithub,
  FaCheckCircle,
  FaExternalLinkAlt,
  FaKey,
  FaSignOutAlt,
  FaSlidersH,
  FaCheck,
  FaArrowRight,
  FaExclamationTriangle,
  FaMoon,
  FaSun
} from 'react-icons/fa';
import confetti from 'canvas-confetti';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../AuthContext';
import { useTheme } from '../useTheme';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();

  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [stats, setStats] = useState(null);
  const [repos, setRepos] = useState([]);

  const handleThemeChange = (newTheme) => {
    handlePreferenceChange('theme', newTheme);
    if (theme !== newTheme) {
      toggleTheme();
    }
  };

  // Form Profile State
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'Senior Reviewer',
    company: 'CodeBuster Labs',
    bio: '',
    avatar_url: ''
  });

  // AI & App Preferences State
  const [preferences, setPreferences] = useState({
    ai_model: 'gemini-2.5-flash',
    ai_persona: 'senior_staff',
    thoroughness: 'strict',
    auto_suggest_fixes: true,
    filter_style_nitpicks: true,
    sound_effects: true,
    email_notifications: true,
    pr_digest: true,
    theme: 'dark'
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const data = await apiClient.get('/auth/profile');
      if (data && data.success && data.user) {
        const u = data.user;
        setFormData({
          username: u.username || u.login || '',
          email: u.email || '',
          role: u.role || 'Senior Reviewer',
          company: u.company || 'CodeBuster Labs',
          bio: u.bio || '',
          avatar_url: u.avatar_url || ''
        });

        if (u.preferences) {
          setPreferences(prev => ({ ...prev, ...u.preferences }));
        }

        setStats(data.stats || {});
        setRepos(data.repositories || []);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      // Fallback to local AuthContext user if offline
      if (user) {
        setFormData(prev => ({
          ...prev,
          username: user.login || user.username || '',
          email: user.email || '',
          avatar_url: user.avatar_url || ''
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePreferenceChange = (field, value) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        ...formData,
        preferences
      };

      const res = await apiClient.put('/auth/profile', payload);
      if (res && res.success) {
        setFeedback({ type: 'success', message: 'Profile & AI preferences saved successfully!' });
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#FF570A', '#25E2A8', '#687FF5']
        });
      } else {
        throw new Error(res.error || 'Failed to save profile');
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        message: 'Error saving profile: ' + (err.message || 'Server error')
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <div className="cb-profile-page d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <Spinner animation="border" style={{ color: '#FF570A', width: '3rem', height: '3rem' }} />
          <div className="mt-3 text-secondary">Loading your engineer profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="cb-profile-page">
      {/* =========================================================================
          1. HERO BANNER PROFILE CARD
          ========================================================================= */}
      <div className="cb-profile-hero">
        <div className="cb-profile-hero__glow" />
        <div className="cb-profile-hero__layout">
          <div className="cb-profile-hero__user">
            <div className="cb-profile-avatar-wrapper">
              {formData.avatar_url ? (
                <img
                  src={formData.avatar_url}
                  alt={formData.username}
                  className="cb-profile-avatar"
                />
              ) : (
                <div className="cb-profile-avatar">
                  {(formData.username || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="cb-profile-status-badge" title="AI Review Session Active" />
            </div>

            <div className="cb-profile-hero__details">
              <div className="cb-profile-name-row">
                <h1 className="cb-profile-title">{formData.username || 'CodeBuster Engineer'}</h1>
                <span className="cb-role-capsule">
                  <FaShieldAlt size={11} /> {formData.role}
                </span>
              </div>

              <div className="cb-profile-handle-row">
                <span>@{formData.username}</span>
                {formData.company && <span>· {formData.company}</span>}
                <a
                  href={`https://github.com/${formData.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cb-github-pill"
                >
                  <FaGithub size={12} /> GitHub Profile <FaExternalLinkAlt size={9} />
                </a>
              </div>

              <p className="cb-profile-bio-text">
                {formData.bio || 'Autonomous code reviewer leveraging full AST repository context and AI verification.'}
              </p>
            </div>
          </div>

          {/* Quick Stats Strip */}
          <div className="cb-profile-stats">
            <div className="cb-stat-pill">
              <span className="cb-stat-pill__label">Repositories</span>
              <span className="cb-stat-pill__value cb-stat-pill__value--orange">
                {stats?.total_repositories || repos.length || 0}
              </span>
            </div>
            <div className="cb-stat-pill">
              <span className="cb-stat-pill__label">Reviews Run</span>
              <span className="cb-stat-pill__value">
                {stats?.total_reviews || 0}
              </span>
            </div>
            <div className="cb-stat-pill">
              <span className="cb-stat-pill__label">AI Engine</span>
              <span className="cb-stat-pill__value cb-stat-pill__value--mint" style={{ fontSize: '1rem' }}>
                Gemini 2.5 Flash
              </span>
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <Alert
          variant={feedback.type}
          onClose={() => setFeedback(null)}
          dismissible
          className="mb-4"
          style={{
            background: feedback.type === 'success' ? 'rgba(37, 226, 168, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            borderColor: feedback.type === 'success' ? '#25E2A8' : '#EF4444',
            color: '#FFFFFF',
            borderRadius: '14px'
          }}
        >
          {feedback.message}
        </Alert>
      )}

      {/* =========================================================================
          2. SEGMENTED TAB NAVIGATION
          ========================================================================= */}
      <div className="cb-profile-tabs">
        <button
          className={`cb-profile-tab-btn ${activeTab === 'general' ? 'cb-profile-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          <FaUser size={14} /> Profile & Identity
        </button>
        <button
          className={`cb-profile-tab-btn ${activeTab === 'ai' ? 'cb-profile-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          <FaRobot size={14} /> AI Reviewer Persona
        </button>
        <button
          className={`cb-profile-tab-btn ${activeTab === 'repos' ? 'cb-profile-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('repos')}
        >
          <FaCodeBranch size={14} /> Connected Repositories ({repos.length})
        </button>
        <button
          className={`cb-profile-tab-btn ${activeTab === 'security' ? 'cb-profile-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <FaShieldAlt size={14} /> Security & OAuth
        </button>
      </div>

      {/* =========================================================================
          3. TAB CONTENT PANELS
          ========================================================================= */}

      {/* --- TAB 1: GENERAL PROFILE --- */}
      {activeTab === 'general' && (
        <div className="cb-profile-panel">
          <div className="cb-panel-title">
            <FaUser style={{ color: '#FF570A' }} /> Personal Information & Engineering Identity
          </div>
          <div className="cb-panel-desc">
            Manage your account credentials, display identity, and organization attributes.
          </div>

          <form onSubmit={handleSave}>
            <div className="cb-form-grid">
              <div className="cb-form-group">
                <label className="cb-form-label">GitHub Username</label>
                <input
                  type="text"
                  className="cb-form-input"
                  value={formData.username}
                  disabled
                />
              </div>

              <div className="cb-form-group">
                <label className="cb-form-label">Work / Primary Email</label>
                <input
                  type="email"
                  className="cb-form-input"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="engineer@company.com"
                />
              </div>

              <div className="cb-form-group">
                <label className="cb-form-label">Title / Role</label>
                <input
                  type="text"
                  className="cb-form-input"
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  placeholder="e.g. Senior Reviewer / Principal Architect"
                />
              </div>

              <div className="cb-form-group">
                <label className="cb-form-label">Company / Team</label>
                <input
                  type="text"
                  className="cb-form-input"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  placeholder="e.g. Acme Corp / Core Infrastructure"
                />
              </div>

              <div className="cb-form-group cb-form-group--full">
                <label className="cb-form-label">Engineering Bio / Focus Area</label>
                <textarea
                  className="cb-form-textarea"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Describe your technical responsibilities, architecture domains, or preferred review standards..."
                />
              </div>
            </div>

            <div className="cb-save-bar">
              <button
                type="submit"
                className="cb-btn cb-btn--primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Spinner size="sm" animation="border" /> Saving Profile...
                  </>
                ) : (
                  <>
                    <FaSave size={14} /> Save Profile Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- TAB 2: AI REVIEWER PERSONA --- */}
      {activeTab === 'ai' && (
        <div className="cb-profile-panel">
          <div className="cb-panel-title">
            <FaRobot style={{ color: '#FF570A' }} /> AI Reviewer Persona & Intelligence Tuning
          </div>
          <div className="cb-panel-desc">
            Tailor the reasoning rigor, tone, and automated remediation depth of CodeBuster's Senior Engineer Agent.
          </div>

          <form onSubmit={handleSave}>
            <div className="cb-form-group mb-4">
              <label className="cb-form-label">Select Active AI Review Persona</label>
              <div className="cb-persona-grid">
                <div
                  className={`cb-persona-card ${preferences.ai_persona === 'senior_staff' ? 'cb-persona-card--active' : ''}`}
                  onClick={() => handlePreferenceChange('ai_persona', 'senior_staff')}
                >
                  <div className="cb-persona-card__header">
                    <span className="cb-persona-card__title">Senior Staff Engineer</span>
                    <span className="cb-persona-card__badge cb-persona-card__badge--orange">RECOMMENDED</span>
                  </div>
                  <p className="cb-persona-card__desc">
                    Comprehensive, educative reasoning focusing on architectural resilience, race conditions, edge cases, and high-impact design defects.
                  </p>
                </div>

                <div
                  className={`cb-persona-card ${preferences.ai_persona === 'security_lead' ? 'cb-persona-card--active' : ''}`}
                  onClick={() => handlePreferenceChange('ai_persona', 'security_lead')}
                >
                  <div className="cb-persona-card__header">
                    <span className="cb-persona-card__title">Zero-Day Security Lead</span>
                    <span className="cb-persona-card__badge" style={{ background: 'rgba(37, 226, 168, 0.15)', color: '#25E2A8' }}>SECURITY</span>
                  </div>
                  <p className="cb-persona-card__desc">
                    Hyper-focused on OWASP Top 10, sanitization, authorization bypasses, cryptographic posture, and vulnerability proof-of-concept diffs.
                  </p>
                </div>

                <div
                  className={`cb-persona-card ${preferences.ai_persona === 'concise' ? 'cb-persona-card--active' : ''}`}
                  onClick={() => handlePreferenceChange('ai_persona', 'concise')}
                >
                  <div className="cb-persona-card__header">
                    <span className="cb-persona-card__title">Zero-Fluff / Rapid CI</span>
                    <span className="cb-persona-card__badge" style={{ background: 'rgba(104, 127, 245, 0.15)', color: '#687FF5' }}>MINIMAL</span>
                  </div>
                  <p className="cb-persona-card__desc">
                    Direct bulleted issues with unified diffs only. No conversational prose or lengthy educational explanations.
                  </p>
                </div>
              </div>
            </div>

            <div className="cb-form-grid">
              <div className="cb-form-group">
                <label className="cb-form-label">Default LLM Reasoning Engine</label>
                <select
                  className="cb-form-select"
                  value={preferences.ai_model}
                  onChange={(e) => handlePreferenceChange('ai_model', e.target.value)}
                >
                  <option value="gemini-2.5-flash">Google Gemini 2.5 Flash (1M Token Context, Fast Reasoning)</option>
                  <option value="groq-llama-3.3-70b">Groq Meta-Llama 3.3 70B (Low Latency Speculative)</option>
                  <option value="openrouter-llama-3.3">OpenRouter Llama 3.3 70B Instruct</option>
                  <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet (State-of-the-Art Code AST)</option>
                </select>
              </div>

              <div className="cb-form-group">
                <label className="cb-form-label">Review Thoroughness Mode</label>
                <select
                  className="cb-form-select"
                  value={preferences.thoroughness}
                  onChange={(e) => handlePreferenceChange('thoroughness', e.target.value)}
                >
                  <option value="strict">Strict (Blocks PR on any medium/high vulnerability)</option>
                  <option value="balanced">Balanced (Prioritizes architecture and functional defects)</option>
                  <option value="standard">Standard (Non-blocking advisory commentary)</option>
                </select>
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="cb-toggle-list">
              <div className="cb-toggle-item">
                <div className="cb-toggle-item__info">
                  <span className="cb-toggle-item__title">Autonomous 1-Click Fix Suggestions</span>
                  <span className="cb-toggle-item__desc">Automatically compute unified replacement diffs ready to accept directly on GitHub.</span>
                </div>
                <label className="cb-switch">
                  <input
                    type="checkbox"
                    checked={preferences.auto_suggest_fixes}
                    onChange={(e) => handlePreferenceChange('auto_suggest_fixes', e.target.checked)}
                  />
                  <span className="cb-slider" />
                </label>
              </div>

              <div className="cb-toggle-item">
                <div className="cb-toggle-item__info">
                  <span className="cb-toggle-item__title">Filter Trivial Style & Formatting Nitpicks</span>
                  <span className="cb-toggle-item__desc">Suppress whitespace, variable naming nuances, and stylistic comments to eliminate alert fatigue.</span>
                </div>
                <label className="cb-switch">
                  <input
                    type="checkbox"
                    checked={preferences.filter_style_nitpicks}
                    onChange={(e) => handlePreferenceChange('filter_style_nitpicks', e.target.checked)}
                  />
                  <span className="cb-slider" />
                </label>
              </div>

              <div className="cb-toggle-item">
                <div className="cb-toggle-item__info">
                  <span className="cb-toggle-item__title">Interactive Celebration & Sound Feedback</span>
                  <span className="cb-toggle-item__desc">Trigger confetti and celebration animations when remediating or applying code patches.</span>
                </div>
                <label className="cb-switch">
                  <input
                    type="checkbox"
                    checked={preferences.sound_effects}
                    onChange={(e) => handlePreferenceChange('sound_effects', e.target.checked)}
                  />
                  <span className="cb-slider" />
                </label>
              </div>
            </div>

            {/* App Appearance & Theme */}
            <div className="cb-form-group mb-4">
              <label className="cb-label">App Appearance & Theme</label>
              <div className="cb-persona-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                <div
                  className={`cb-persona-card ${(preferences.theme || theme) === 'dark' ? 'cb-persona-card--active' : ''}`}
                  onClick={() => handleThemeChange('dark')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="cb-persona-card__header">
                    <div className="d-flex align-items-center gap-2">
                      <FaMoon style={{ color: '#FF570A' }} />
                      <span className="cb-persona-card__title">Obsidian Dark</span>
                    </div>
                    {(preferences.theme || theme) === 'dark' && (
                      <span className="cb-persona-card__badge cb-persona-card__badge--orange">Active</span>
                    )}
                  </div>
                  <p className="cb-persona-card__desc">
                    CodeRabbit Forge deep space palette with Safety Orange and Mint accents.
                  </p>
                </div>

                <div
                  className={`cb-persona-card ${(preferences.theme || theme) === 'light' ? 'cb-persona-card--active' : ''}`}
                  onClick={() => handleThemeChange('light')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="cb-persona-card__header">
                    <div className="d-flex align-items-center gap-2">
                      <FaSun style={{ color: '#F59E0B' }} />
                      <span className="cb-persona-card__title">Clean Light</span>
                    </div>
                    {(preferences.theme || theme) === 'light' && (
                      <span className="cb-persona-card__badge cb-persona-card__badge--orange">Active</span>
                    )}
                  </div>
                  <p className="cb-persona-card__desc">
                    High-contrast daylight theme for bright display environments.
                  </p>
                </div>
              </div>
            </div>

            <div className="cb-save-bar">
              <button
                type="submit"
                className="cb-btn cb-btn--primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Spinner size="sm" animation="border" /> Updating Persona...
                  </>
                ) : (
                  <>
                    <FaSave size={14} /> Update AI Preferences
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- TAB 3: CONNECTED REPOSITORIES --- */}
      {activeTab === 'repos' && (
        <div className="cb-profile-panel">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <div className="cb-panel-title">
                <FaCodeBranch style={{ color: '#FF570A' }} /> Connected Repositories ({repos.length})
              </div>
              <div className="cb-panel-desc mb-0">
                Repositories linked to your GitHub account under CodeBuster AST monitoring.
              </div>
            </div>
            <Link to="/repos/search" className="cb-btn cb-btn--primary cb-btn--sm">
              <FaGithub size={13} /> Connect New Repository
            </Link>
          </div>

          {repos.length === 0 ? (
            <div className="text-center py-5" style={{ background: 'rgba(7, 8, 12, 0.4)', borderRadius: '16px' }}>
              <FaCodeBranch size={42} style={{ color: '#4B5563', marginBottom: '1rem' }} />
              <h5 className="text-white">No Connected Repositories Yet</h5>
              <p className="text-secondary small mb-3">Connect your first GitHub repository to trigger AI code reviews.</p>
              <Link to="/repos/search" className="cb-btn cb-btn--primary">
                Explore Repositories
              </Link>
            </div>
          ) : (
            <div className="cb-repo-grid mt-3">
              {repos.map(repo => (
                <div key={repo.id} className="cb-repo-card">
                  <div>
                    <div className="cb-repo-card__name">{repo.full_name}</div>
                    <div className="cb-repo-card__badges">
                      <span className="cb-repo-badge cb-repo-badge--mint">
                        <FaCheckCircle size={10} className="me-1" /> Active Listener
                      </span>
                      {repo.language && (
                        <span className="cb-repo-badge">{repo.language}</span>
                      )}
                      <span className="cb-repo-badge">
                        {repo.reviews_count || 0} reviews
                      </span>
                    </div>
                  </div>

                  <div className="cb-repo-card__actions">
                    <Link
                      to={`/repos/${repo.id}`}
                      className="cb-btn cb-btn--ghost cb-btn--sm flex-grow-1 text-center"
                    >
                      Dashboard <FaArrowRight size={10} className="ms-1" />
                    </Link>
                    <Link
                      to={`/repos/${repo.id}/settings`}
                      className="cb-btn cb-btn--ghost cb-btn--sm"
                      title="Repository Settings"
                    >
                      <FaSlidersH size={12} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: SECURITY & OAUTH --- */}
      {activeTab === 'security' && (
        <div className="cb-profile-panel">
          <div className="cb-panel-title">
            <FaShieldAlt style={{ color: '#FF570A' }} /> Security & Authentication Credentials
          </div>
          <div className="cb-panel-desc">
            Cryptographic storage, active OAuth scopes, and session lifecycle controls.
          </div>

          <div className="cb-form-grid mb-4">
            <div className="cb-stat-pill" style={{ background: 'rgba(7, 8, 12, 0.65)' }}>
              <span className="cb-stat-pill__label">OAuth Provider</span>
              <span className="cb-stat-pill__value" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FaGithub size={16} /> GitHub OAuth 2.0
              </span>
            </div>

            <div className="cb-stat-pill" style={{ background: 'rgba(7, 8, 12, 0.65)' }}>
              <span className="cb-stat-pill__label">Token Encryption</span>
              <span className="cb-stat-pill__value cb-stat-pill__value--mint" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FaCheckCircle size={14} /> AES-256 Fernet Active
              </span>
            </div>

            <div className="cb-stat-pill" style={{ background: 'rgba(7, 8, 12, 0.65)' }}>
              <span className="cb-stat-pill__label">CSRF Protection</span>
              <span className="cb-stat-pill__value cb-stat-pill__value--mint" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FaCheckCircle size={14} /> HMAC-SHA256 Validated
              </span>
            </div>
          </div>

          <div className="cb-toggle-list">
            <div className="cb-toggle-item">
              <div className="cb-toggle-item__info">
                <span className="cb-toggle-item__title">Email Review Alerts</span>
                <span className="cb-toggle-item__desc">Receive real-time notifications when critical zero-day vulnerabilities or security bugs are flagged.</span>
              </div>
              <label className="cb-switch">
                <input
                  type="checkbox"
                  checked={preferences.email_notifications}
                  onChange={(e) => handlePreferenceChange('email_notifications', e.target.checked)}
                />
                <span className="cb-slider" />
              </label>
            </div>

            <div className="cb-toggle-item">
              <div className="cb-toggle-item__info">
                <span className="cb-toggle-item__title">Weekly Engineering Digest</span>
                <span className="cb-toggle-item__desc">Weekly summary of code quality trends, issues remediated, and velocity metrics across all repositories.</span>
              </div>
              <label className="cb-switch">
                <input
                  type="checkbox"
                  checked={preferences.pr_digest}
                  onChange={(e) => handlePreferenceChange('pr_digest', e.target.checked)}
                />
                <span className="cb-slider" />
              </label>
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mt-4 pt-4 border-top border-secondary border-opacity-10">
            <div>
              <div className="fw-semibold text-white">Sign Out of Session</div>
              <div className="text-secondary small">Terminates the current Flask and Vite OAuth session.</div>
            </div>
            <button
              onClick={handleLogout}
              className="cb-btn cb-btn--danger"
            >
              <FaSignOutAlt size={14} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
