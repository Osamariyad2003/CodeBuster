import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaGithub,
  FaArrowRight,
  FaLayerGroup,
  FaProjectDiagram,
  FaClock,
  FaInbox,
  FaCommentDots,
  FaChartPie,
  FaShieldAlt,
  FaBolt,
  FaCheckCircle,
  FaCode,
} from 'react-icons/fa';
import { Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../AuthContext';
import './LandingPage.css';

const FEATURES = [
  {
    icon: FaLayerGroup,
    title: 'AI-Powered Reviews',
    desc: 'Every push is scanned across security, performance, maintainability and complexity, with issues explained in plain language and ranked by real impact.',
  },
  {
    icon: FaChartPie,
    title: 'Health Score Dashboard',
    desc: 'A single, trustworthy score per repository that tracks engineering health over time — so you know at a glance what needs attention.',
  },
  {
    icon: FaProjectDiagram,
    title: 'Constellation View',
    desc: 'Visualize how files and modules depend on each other, and spot the fragile, high-blast-radius code before it breaks something else.',
  },
  {
    icon: FaClock,
    title: 'Time Travel',
    desc: 'Rewind through your review history to see exactly when quality shifted, which commit introduced it, and whether it ever got fixed.',
  },
  {
    icon: FaInbox,
    title: 'Commits Inbox',
    desc: 'A triage-first inbox for every incoming commit, so nothing meaningful slips through unreviewed.',
  },
  {
    icon: FaCommentDots,
    title: 'Finding Quality Feedback',
    desc: 'Mark findings as useful or noisy and the reviewer adapts, cutting false positives out of your workflow over time.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Connect your GitHub repos',
    desc: 'Authenticate with GitHub and pick the repositories you want CodeBuster watching. No config files, no CI setup required.',
  },
  {
    n: '02',
    title: 'Let the AI agents review',
    desc: 'Every commit and pull request is analyzed across multiple dimensions — security, performance, dependencies, dead code and more.',
  },
  {
    n: '03',
    title: 'Fix what actually matters',
    desc: 'Get a prioritized, fix-first checklist instead of a wall of warnings, with health trends that prove the codebase is improving.',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await login();
    } catch (err) {
      setError('Failed to initiate login: ' + err.message);
      setIsLoading(false);
    }
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5).toFixed(4);
    const y = ((event.clientY - rect.top) / rect.height - 0.5).toFixed(4);

    event.currentTarget.style.setProperty('--mx', x);
    event.currentTarget.style.setProperty('--my', y);
  };

  const handlePointerLeave = (event) => {
    event.currentTarget.style.setProperty('--mx', '0');
    event.currentTarget.style.setProperty('--my', '0');
  };

  if (loading) {
    return (
      <div className="lp-loading">
        <Spinner animation="border" role="status" style={{ color: 'var(--primary-brand)' }}>
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div className="lp-root" onMouseMove={handlePointerMove} onMouseLeave={handlePointerLeave}>
      {/* Nav */}
      <header className="lp-nav">
        <div className="lp-nav__inner">
          <div className="lp-brand">
            <div className="lp-brand__icon">CB</div>
            <span className="lp-brand__text">CodeBuster</span>
          </div>
          <nav className="lp-nav__links">
            <button onClick={() => scrollTo('lp-features')}>Features</button>
            <button onClick={() => scrollTo('lp-how')}>How it works</button>
            <button onClick={() => scrollTo('lp-dimensions')}>Analysis</button>
          </nav>
          <button className="lp-btn lp-btn--ghost lp-nav__cta" onClick={handleLogin} disabled={isLoading}>
            <FaGithub size={16} /> Sign in
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero__motion" aria-hidden="true">
          <span className="lp-motion-grid" />
          <span className="lp-motion-line lp-motion-line--one" />
          <span className="lp-motion-line lp-motion-line--two" />
          <span className="lp-motion-pane lp-motion-pane--one" />
          <span className="lp-motion-pane lp-motion-pane--two" />
        </div>
        <div className="lp-hero__badge">
          <FaBolt size={12} /> AI-powered engineering health analysis
        </div>
        <h1 className="lp-hero__title">
          Know your codebase's health<br /> before it becomes a problem.
        </h1>
        <p className="lp-hero__subtitle">
          CodeBuster connects to your GitHub repositories and continuously reviews every commit —
          catching security risks, performance regressions and maintainability debt, and turning
          them into a prioritized checklist your team will actually act on.
        </p>

        {error && (
          <Alert variant="danger" className="lp-hero__alert">
            {error}
          </Alert>
        )}

        <div className="lp-hero__actions">
          <button className="lp-btn lp-btn--primary" onClick={handleLogin} disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner size="sm" animation="border" /> Connecting...
              </>
            ) : (
              <>
                <FaGithub size={18} /> Sign in with GitHub
              </>
            )}
          </button>
          <button className="lp-btn lp-btn--secondary" onClick={() => scrollTo('lp-how')}>
            See how it works <FaArrowRight size={12} />
          </button>
        </div>

        <div className="lp-hero__note">
          Free to connect &middot; No credit card &middot; Read access to your repos only
        </div>

        {/* Preview card */}
        <div className="lp-hero__preview">
          <div className="lp-preview-card">
            <div className="lp-preview-card__header">
              <div className="lp-preview-dots">
                <span /><span /><span />
              </div>
              <span className="lp-preview-card__title">Repository Health</span>
            </div>
            <div className="lp-preview-card__body">
              <div className="lp-preview-card__scan" aria-hidden="true" />
              <div className="lp-score-ring">
                <span className="lp-score-ring__value">82</span>
                <span className="lp-score-ring__label">Health Score</span>
              </div>
              <div className="lp-preview-metrics">
                <div className="lp-preview-metric">
                  <span className="lp-preview-metric__label"><FaShieldAlt size={12} /> Security</span>
                  <div className="lp-bar"><div className="lp-bar__fill" style={{ width: '88%', background: 'var(--color-success)' }} /></div>
                </div>
                <div className="lp-preview-metric">
                  <span className="lp-preview-metric__label"><FaBolt size={12} /> Performance</span>
                  <div className="lp-bar"><div className="lp-bar__fill" style={{ width: '74%', background: 'var(--color-info)' }} /></div>
                </div>
                <div className="lp-preview-metric">
                  <span className="lp-preview-metric__label"><FaCode size={12} /> Maintainability</span>
                  <div className="lp-bar"><div className="lp-bar__fill" style={{ width: '69%', background: 'var(--color-ai-insight)' }} /></div>
                </div>
              </div>
              <div className="lp-preview-feed" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="lp-features" className="lp-section">
        <div className="lp-section__head">
          <span className="lp-eyebrow">Features</span>
          <h2>Everything you need to keep quality visible</h2>
          <p>One platform for the review, triage and history that usually lives across five different tools.</p>
        </div>
        <div className="lp-grid">
          {FEATURES.map((f, index) => (
            <div
              className="lp-feature-card lp-reveal"
              key={f.title}
              style={{ '--reveal-delay': `${index * 70}ms` }}
            >
              <div className="lp-feature-card__icon">
                <f.icon size={20} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="lp-how" className="lp-section lp-section--alt">
        <div className="lp-section__head">
          <span className="lp-eyebrow">How it works</span>
          <h2>From GitHub login to fixed issues in minutes</h2>
        </div>
        <div className="lp-steps">
          {STEPS.map((s, i) => (
            <div
              className="lp-step lp-reveal"
              key={s.n}
              style={{ '--reveal-delay': `${i * 100}ms` }}
            >
              <div className="lp-step__num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              {i < STEPS.length - 1 && <div className="lp-step__connector" />}
            </div>
          ))}
        </div>
      </section>

      {/* Dimensions */}
      <section id="lp-dimensions" className="lp-section">
        <div className="lp-section__head">
          <span className="lp-eyebrow">Multi-dimensional analysis</span>
          <h2>Not just linting — real engineering signal</h2>
        </div>
        <div className="lp-tags">
          {['Security', 'Performance', 'Maintainability', 'Dead Code', 'Dependencies', 'Code Quality', 'Complexity', 'Test Coverage'].map((t, index) => (
            <span
              className="lp-tag lp-reveal"
              key={t}
              style={{ '--reveal-delay': `${index * 45}ms` }}
            >
              <FaCheckCircle size={12} /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta">
        <h2>Start reviewing your codebase for free</h2>
        <p>Connect a repository in under a minute. No setup, no CI pipeline changes.</p>
        <button className="lp-btn lp-btn--primary lp-btn--lg" onClick={handleLogin} disabled={isLoading}>
          <FaGithub size={18} /> Sign in with GitHub
        </button>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-brand">
          <div className="lp-brand__icon">CB</div>
          <span className="lp-brand__text">CodeBuster</span>
        </div>
        <span className="lp-footer__copy">&copy; {new Date().getFullYear()} CodeBuster. AI-powered engineering health analysis.</span>
      </footer>
    </div>
  );
};

export default LandingPage;
