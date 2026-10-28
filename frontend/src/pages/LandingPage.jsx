import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  FaGithub,
  FaArrowRight,
  FaCheck,
  FaCheckCircle,
  FaTimes,
  FaBolt,
  FaShieldAlt,
  FaRobot,
  FaCode,
  FaLock,
  FaChevronDown,
  FaChevronUp,
  FaPlay,
  FaCommentDots,
  FaProjectDiagram,
  FaClock,
  FaLayerGroup,
  FaExternalLinkAlt,
  FaMagic,
  FaStar,
  FaQuoteLeft,
  FaUsers,
  FaTerminal,
  FaRegCopy,
  FaServer,
} from 'react-icons/fa';
import {
  SiGitlab,
  SiDocker,
  SiKubernetes,
  SiTypescript,
  SiPython,
  SiGo,
  SiRust,
  SiVercel,
  SiSupabase,
  SiAmazonaws,
} from 'react-icons/si';
import { Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../AuthContext';
import { RabbitIcon, BrandLogo } from '../components/brand/BrandLogo';
import './LandingPage.css';

// Pre-canned AI responses for the interactive PR chat demo
const DEMO_CHAT_RESPONSES = {
  test: {
    prompt: '@codebuster generate Jest unit tests for the Redis failover case',
    response: `### 🧪 Auto-Generated Jest Unit Test Suite
\`\`\`typescript
describe('RateLimiter Distributed Redis Failover', () => {
  it('should atomically acquire lock and assign TTL under race condition', async () => {
    const mockRedis = createMockRedisCluster();
    const limiter = new RateLimiter(mockRedis, { windowSeconds: 60 });

    // Simulate 50 concurrent requests hitting within 2ms
    const requests = Array.from({ length: 50 }).map(() =>
      limiter.consumeToken('org_acme_prod')
    );
    const results = await Promise.all(requests);

    // Strictly 1st request acquires token bucket, remaining throttled
    expect(results[0].allowed).toBe(true);
    expect(results.filter(r => !r.allowed).length).toBe(49);
    expect(await mockRedis.ttl('org_acme_prod')).toBeGreaterThan(0);
  });
});
\`\`\`
*Verified against your tsconfig.json & Jest 29 config. All assertions pass.*`,
  },
  complexity: {
    prompt: '@codebuster explain Big-O time and space complexity of this PR',
    response: `### 📊 Algorithmic Complexity Analysis
* **Time Complexity**: **O(1)** amortized. The Redis atomic \`MULTI/EXEC\` sliding window check performs constant-time pointer arithmetic and hash lookups regardless of token bucket capacity.
* **Space Complexity**: **O(K)** where \`K\` is the number of active concurrent tenant tokens (\`~24 bytes\` per key with TTL). Automatically evicted upon expiration.
* **Network Overhead**: Batch pipeline drops network roundtrips from **2 RTTs (3.4ms)** to **1 atomic RTT (0.8ms)**.`,
  },
  owasp: {
    prompt: '@codebuster check compliance with OWASP API Security Top 10',
    response: `### 🛡️ OWASP API Security Audit: PASS (10/10)
* **API4:2023 (Unrestricted Resource Consumption)**: Fixed! Atomic Redis token bucket prevents volumetric DoS and endpoint exhaustion.
* **API2:2023 (Broken Authentication)**: Cryptographic HMAC token verified prior to pipeline execution.
* **API8:2023 (Security Misconfiguration)**: Ephemeral TTL keys prevent state leakage across multi-tenant shards.`,
  },
};

const BENTO_FEATURES = [
  {
    icon: FaProjectDiagram,
    tag: 'Context Engine',
    wide: true,
    title: 'Full-Repository AST & Semantic Context',
    desc: 'Never reviews diffs in isolation. CodeBuster indexes your entire abstract syntax tree, type hierarchies, and cross-package call graphs to catch breaks three layers deep.',
    accent: '#FF570A',
    badge: 'Multi-File Aware',
    preview: (
      <div className="cr-bento-preview cr-bento-preview--code">
        <div className="cr-code-line"><span className="token-fn">analyzeAstGraph</span>(<span className="token-arg">repoRoot</span>)</div>
        <div className="cr-code-line cr-code-line--hit">├── src/auth/session.ts <span className="cr-pill-sm cr-pill-sm--green">+0 breaks</span></div>
        <div className="cr-code-line cr-code-line--warn">└── src/db/pool.ts <span className="cr-pill-sm cr-pill-sm--orange">⚠ Leak Risk</span></div>
      </div>
    ),
  },
  {
    icon: FaMagic,
    tag: 'Instant Walkthrough',
    title: 'Automated Sequence Flows & PR Overviews',
    desc: 'Summarizes massive 50-file PRs in 10 seconds. Auto-generates architectural sequence flows and grouped layer walkthroughs before teammates read a line of code.',
    accent: '#687FF5',
    badge: '10x Faster Review',
    preview: (
      <div className="cr-bento-preview cr-bento-preview--flow">
        <div className="cr-flow-badge">Client ➔ Ingress ➔ Auth Guard ➔ DB</div>
        <div className="cr-flow-stats">
          <span className="cr-badge-chip">TL;DR Generated</span>
          <span className="cr-badge-chip">Latency &lt; 0.4ms</span>
        </div>
      </div>
    ),
  },
  {
    icon: FaBolt,
    tag: '1-Click Fixes',
    title: 'Verified Code Patches & Unit Tests',
    desc: 'Don’t just receive vague comments. CodeBuster writes tested, drop-in replacement diffs that respect your coding standards and can be committed with a single click.',
    accent: '#25E2A8',
    badge: 'One Click Commit',
    preview: (
      <div className="cr-bento-preview cr-bento-preview--diff">
        <div className="cr-diff-del">- await db.query(rawSql)</div>
        <div className="cr-diff-add">{'+ await db.query(sql`SELECT ... WHERE id = ${id}`);'}</div>
      </div>
    ),
  },
  {
    icon: FaShieldAlt,
    tag: 'Zero-Day Shield',
    wide: true,
    title: 'Continuous Vulnerability & Secret Triage',
    desc: 'Scans for hardcoded credentials, SQL injection, race conditions, memory leaks, and vulnerable dependencies with continuous posture checks and zero false positives.',
    accent: '#FF570A',
    badge: 'CWE / OWASP Ready',
    preview: (
      <div className="cr-bento-preview cr-bento-preview--shield">
        <div className="d-flex align-items-center justify-content-between mb-1">
          <span className="fw-bold" style={{ color: '#25E2A8' }}>0 Leaked Secrets</span>
          <span className="cr-pill-sm cr-pill-sm--green">PASSED</span>
        </div>
        <div className="text-secondary" style={{ fontSize: '11px' }}>OWASP API Security Top 10 Enforced</div>
      </div>
    ),
  },
  {
    icon: FaClock,
    tag: 'Engineering Intelligence',
    title: 'Constellation Maps & Time Travel',
    desc: 'Rewind through historical commits to see exactly when architectural debt was introduced, and visualize blast-radius before high-risk changes hit staging.',
    accent: '#A855F7',
    badge: 'Blast-Radius Guard',
    preview: (
      <div className="cr-bento-preview cr-bento-preview--health">
        <div className="d-flex align-items-baseline gap-2">
          <span style={{ fontSize: '20px', fontWeight: 800, color: '#25E2A8' }}>94%</span>
          <span className="text-secondary" style={{ fontSize: '12px' }}>Codebase Health Score (+8%)</span>
        </div>
        <div className="cr-bar-mini"><div className="cr-bar-mini__fill" style={{ width: '94%' }} /></div>
      </div>
    ),
  },
  {
    icon: FaCommentDots,
    tag: 'Noise Suppression',
    title: 'Adaptive Learning From Team Feedback',
    desc: 'Give findings a thumbs up or down. CodeBuster adapts to your team’s custom review guidelines and suppresses pedantic style nitpicks.',
    accent: '#25E2A8',
    badge: 'Zero Nitpicks',
    preview: (
      <div className="cr-bento-preview cr-bento-preview--feedback">
        <span className="cr-pill-sm cr-pill-sm--green">👍 99.4% Actionable Rating</span>
        <span className="text-secondary" style={{ fontSize: '11px' }}>Learns conventions over time</span>
      </div>
    ),
  },
];

const COMPARISON_ROWS = [
  {
    feature: 'Multi-File AST & Repository Context',
    codebuster: true,
    sonar: 'Partial (single-file AST)',
    chatgpt: false,
  },
  {
    feature: 'Native Inline GitHub & GitLab PR Comments',
    codebuster: true,
    sonar: 'Complex CI setup',
    chatgpt: false,
  },
  {
    feature: '1-Click Drop-in Git Commit Patches',
    codebuster: true,
    sonar: false,
    chatgpt: 'Manual copy-paste',
  },
  {
    feature: 'Automated Architectural Sequence Diagrams',
    codebuster: true,
    sonar: false,
    chatgpt: false,
  },
  {
    feature: 'Interactive PR Conversation & Test Generation',
    codebuster: true,
    sonar: false,
    chatgpt: 'No repo context',
  },
  {
    feature: 'Constellation Blast-Radius Impact Mapping',
    codebuster: true,
    sonar: false,
    chatgpt: false,
  },
  {
    feature: 'Zero Data Retention (Never trains on code)',
    codebuster: true,
    sonar: 'Self-hosted only',
    chatgpt: 'Varies / opt-out',
  },
  {
    feature: 'Setup Time',
    codebuster: '60 Seconds (GitHub App)',
    sonar: 'Hours / CI YAML',
    chatgpt: 'Manual prompts',
  },
];

const FAQS = [
  {
    q: 'Does CodeBuster train public AI models on our proprietary code?',
    a: 'Absolutely not. We maintain a strict Zero Data Retention policy. Your repositories and pull request diffs are processed ephemerally in memory-isolated sandboxes and are immediately discarded after the review comments are synthesized. We do not store, log, or use your intellectual property for AI training.',
  },
  {
    q: 'How does CodeBuster prevent hallucinating bugs or pedantic nitpicks?',
    a: 'Unlike generic LLM wrappers, CodeBuster combines symbolic static analysis, Abstract Syntax Tree (AST) compilation, and multi-agent cross-verification. Every finding is assigned an AI confidence score. Trivial style nitpicks are filtered out, ensuring your engineers only see high-impact security, performance, and logic defects.',
  },
  {
    q: 'How long does it take to install and configure CodeBuster?',
    a: 'Under 60 seconds. You authenticate with your GitHub account, grant read/write access to your desired repositories, and CodeBuster automatically hooks into your PR pipeline. There are no YAML configurations to maintain and no CI runners to provision.',
  },
  {
    q: 'How does the 1-Click Fix feature work?',
    a: 'When CodeBuster detects a remediation opportunity (like an unhandled exception, missing lock flag, or SQL parameterization), it generates an exact unified diff. You or your team can simply click "Accept Fix" directly on GitHub, and CodeBuster commits the patch directly to your PR branch.',
  },
  {
    q: 'Can we customize review rules to match our internal coding standards?',
    a: 'Yes! You can define custom review guidelines via markdown or simple prompt directives in your repository root (`.codebuster.yml` or UI settings). CodeBuster will strictly enforce your specific architectural patterns, naming conventions, and libraries.',
  },
  {
    q: 'What languages and frameworks are supported?',
    a: 'CodeBuster provides deep AST and semantic analysis for TypeScript, JavaScript, Python, Go, Rust, Java, C#, C++, PHP, Ruby, SQL, Dockerfiles, Terraform, and Kubernetes manifests.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'CodeBuster cut our PR turnaround time from 22 hours to under 30 minutes. It catches race conditions and authorization bypasses before human reviewers even open the diff.',
    author: 'Alexandre Rivera',
    role: 'VP of Engineering, HyperScale Cloud',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    stat: '75% Faster Merges',
  },
  {
    quote:
      'The automated sequence diagrams and 1-click patches are an absolute game changer. Senior engineers spend zero time writing boilerplate review comments now.',
    author: 'Marcus Vance',
    role: 'Principal Architect, Fintech Core',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    stat: '12h Saved / Week',
  },
  {
    quote:
      'It’s like having a Staff Engineer reviewing every single pull request with complete repository context. The false-positive rate is practically zero.',
    author: 'Evelyn Zhao',
    role: 'Lead Platform Engineer, DevPulse',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    stat: '99% Dev Approval',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { login, demoLogin, isAuthenticated, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [error, setError] = useState(null);

  // Interactive Demo State
  const [activeDemoTab, setActiveDemoTab] = useState('diff');
  const [fixApplied, setFixApplied] = useState(false);
  const [activeChatKey, setActiveChatKey] = useState('test');
  const [billingCycle, setBillingCycle] = useState('annual');
  const [openFaq, setOpenFaq] = useState(0);
  const [feedbackVote, setFeedbackVote] = useState(null);

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
      setError('Failed to initiate login: ' + (err.message || 'Network error'));
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    setError(null);
    try {
      await demoLogin();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('Failed to initiate demo session: ' + (err.message || 'Server error'));
      setIsDemoLoading(false);
    }
  };

  const handleApplyFix = (e) => {
    e.stopPropagation();
    setFixApplied(true);
    confetti({
      particleCount: 75,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#FF570A', '#25E2A8', '#687FF5', '#FFFFFF'],
    });
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="cr-loading-screen">
        <RabbitIcon size={48} className="cr-pulse-glow" />
        <div className="mt-3 text-secondary" style={{ fontSize: '14px', letterSpacing: '0.04em' }}>
          Initializing CodeBuster Engine…
        </div>
      </div>
    );
  }

  return (
    <div className="cr-landing">
      {/* Background Ambient Glows & Grid */}
      <div className="cr-ambient-glow cr-ambient-glow--top" aria-hidden="true" />
      <div className="cr-ambient-glow cr-ambient-glow--bottom" aria-hidden="true" />
      <div className="cr-grid-blueprint" aria-hidden="true" />

      {/* ==================== 1. TOP NAVIGATION ==================== */}
      <header className="cr-nav">
        <div className="cr-nav__inner">
          <div className="cr-nav__brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <BrandLogo size={28} />
          </div>

          <nav className="cr-nav__menu d-none d-lg-flex">
            <button onClick={() => scrollTo('demo')}>Interactive Demo</button>
            <button onClick={() => scrollTo('features')}>Features</button>
            <button onClick={() => scrollTo('how')}>How It Works</button>
            <button onClick={() => scrollTo('compare')}>Comparison</button>
            <button onClick={() => scrollTo('security')}>Security</button>
            <button onClick={() => scrollTo('pricing')}>Pricing</button>
            <button onClick={() => scrollTo('faq')}>FAQ</button>
          </nav>

          <div className="cr-nav__actions">
            <button className="cr-btn cr-btn--ghost d-none d-sm-inline-flex" onClick={handleDemoLogin} disabled={isLoading || isDemoLoading}>
              {isDemoLoading ? <Spinner size="sm" animation="border" /> : 'Instant Demo'}
            </button>
            <button className="cr-btn cr-btn--primary cr-nav__cta" onClick={handleLogin} disabled={isLoading || isDemoLoading}>
              {isLoading ? (
                <>
                  <Spinner size="sm" animation="border" /> Connecting...
                </>
              ) : (
                <>
                  <FaGithub size={16} /> Sign in with GitHub
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ==================== 2. HERO SECTION ==================== */}
      <section className="cr-hero">
        <div className="cr-container text-center">
          {/* Announcement Pill */}
          <div className="cr-pill-announcement" onClick={() => scrollTo('demo')}>
            <span className="cr-pulse-dot" />
            <span className="fw-semibold">Autonomous AI Review Agent 2.0</span>
            <span className="cr-pill-separator">·</span>
            <span className="text-secondary">Full Repository AST Context & 1-Click Fixes</span>
            <FaArrowRight size={11} className="ms-1" />
          </div>

          {/* Main Headline */}
          <h1 className="cr-hero__headline">
            Ship more software, faster,<br />
            <span className="cr-gradient-text">with code you trust.</span>
          </h1>

          {/* Subtitle */}
          <p className="cr-hero__subtitle">
            CodeBuster is your independent AI code review platform. It combines full-repository AST context,
            automated PR triage, visual sequence flows, and verified one-click fixes — seamlessly integrated
            directly into your GitHub and GitLab workflow.
          </p>

          {error && (
            <Alert variant="danger" className="cr-hero__alert mx-auto mb-4">
              {error}
            </Alert>
          )}

          {/* Call to Actions */}
          <div className="cr-hero__cta-group">
            <button className="cr-btn cr-btn--primary cr-btn--xl" onClick={handleLogin} disabled={isLoading || isDemoLoading}>
              {isLoading ? (
                <>
                  <Spinner size="sm" animation="border" /> Connecting to GitHub...
                </>
              ) : (
                <>
                  <FaGithub size={20} /> Sign in with GitHub <FaArrowRight size={14} className="ms-1" />
                </>
              )}
            </button>
            <button className="cr-btn cr-btn--glass cr-btn--xl" onClick={handleDemoLogin} disabled={isLoading || isDemoLoading}>
              {isDemoLoading ? (
                <>
                  <Spinner size="sm" animation="border" /> Entering Workspace...
                </>
              ) : (
                <>
                  <FaPlay size={14} style={{ color: '#25E2A8' }} /> Explore Live App Demo
                </>
              )}
            </button>
          </div>

          {/* Trust Value Badges */}
          <div className="cr-hero__trust-strip">
            <div className="cr-trust-pill"><FaCheck size={12} /> Free for Open Source</div>
            <div className="cr-trust-pill"><FaLock size={12} /> SOC 2 Type II Certified</div>
            <div className="cr-trust-pill"><FaShieldAlt size={12} /> Zero Code Retention (Never trained on your code)</div>
            <div className="cr-trust-pill"><FaBolt size={12} /> 60-Second Setup, No CI Config</div>
          </div>
        </div>

        {/* ==================== 3. SIGNATURE INTERACTIVE PR REVIEW WORKBENCH ==================== */}
        <div id="demo" className="cr-demo-section cr-container">
          <div className="cr-workbench-shell">
            <div className="cr-workbench">
            {/* PR Header Toolbar */}
            <div className="cr-workbench__header">
              <div className="d-flex align-items-center gap-3">
                <div className="cr-workbench__dots">
                  <span /><span /><span />
                </div>
                <div className="cr-workbench__address-capsule d-none d-md-flex">
                  <FaLock size={10} style={{ color: '#25E2A8' }} />
                  <span className="cr-address-host">github.com</span>
                  <span className="cr-address-sep">/</span>
                  <span className="cr-address-repo">codebuster</span>
                  <span className="cr-address-sep">/</span>
                  <span className="cr-address-pr">pull/1428</span>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <span className="cr-pill-sm cr-pill-sm--green">
                  <FaShieldAlt size={11} /> 94 / 100 Health
                </span>
                <div className="cr-workbench__status-capsule">
                  <span className="cr-pulse-dot cr-pulse-dot--green" />
                  <span className="d-none d-sm-inline">AI Review Ready</span>
                  <span className="d-sm-none">Ready</span>
                </div>
              </div>
            </div>

            {/* Meta bar */}
            <div className="cr-workbench__meta">
              <div className="d-flex align-items-center gap-2 text-secondary flex-wrap" style={{ fontSize: '12px' }}>
                <span className="cr-pill-git cr-pill-git--open">Open</span>
                <span className="text-white fw-semibold">#1428 feat(auth): add distributed Redis token bucket</span>
                <span className="cr-meta-sep">·</span>
                <span className="cr-branch-chip">main</span>
                <span className="cr-branch-arrow">←</span>
                <span className="cr-branch-chip cr-branch-chip--head">feature/resilient-token-bucket</span>
              </div>

              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="cr-stat-pill cr-stat-pill--green">+314</span>
                <span className="cr-stat-pill cr-stat-pill--red">-42</span>
                <span className="cr-badge-chip cr-badge-chip--green">✓ 4 checks passed</span>
                <span className="cr-badge-chip">AST Index: Ready</span>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="cr-workbench__tabs-wrapper">
              <div className="cr-workbench__tabs">
              <button
                className={`cr-workbench__tab ${activeDemoTab === 'diff' ? 'cr-workbench__tab--active' : ''}`}
                onClick={() => setActiveDemoTab('diff')}
              >
                <FaBolt size={13} /> Inline Diff &amp; 1-Click Fix
                <span className="cr-tab-counter">1 Actionable</span>
              </button>
              <button
                className={`cr-workbench__tab ${activeDemoTab === 'summary' ? 'cr-workbench__tab--active' : ''}`}
                onClick={() => setActiveDemoTab('summary')}
              >
                <FaLayerGroup size={13} /> Summary &amp; Walkthrough
              </button>
              <button
                className={`cr-workbench__tab ${activeDemoTab === 'diagram' ? 'cr-workbench__tab--active' : ''}`}
                onClick={() => setActiveDemoTab('diagram')}
              >
                <FaProjectDiagram size={13} /> Sequence Flow
              </button>
              <button
                className={`cr-workbench__tab ${activeDemoTab === 'chat' ? 'cr-workbench__tab--active' : ''}`}
                onClick={() => setActiveDemoTab('chat')}
              >
                <FaCommentDots size={13} /> Agentic PR Chat
              </button>
              </div>
            </div>

            {/* Tab Body */}
            <div className="cr-workbench__body">
              {/* TAB 1: INLINE DIFF & 1-CLICK FIX */}
              {activeDemoTab === 'diff' && (
                <div className="cr-tab-pane">
                  <div className="cr-diff-header">
                    <span className="cr-diff-filename">
                      <FaCode size={13} style={{ color: '#FF570A' }} /> src/services/rateLimiter.ts
                    </span>
                    <span className="text-secondary" style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                      TypeScript · Concurrency &amp; State Check
                    </span>
                  </div>

                  {/* Code Snippet Box */}
                  <div className="cr-code-diff">
                    <div className="cr-code-diff__line cr-code-diff__line--ctx">
                      <span className="cr-line-num">40</span>
                      <span className="cr-line-content">  export async function consumeRateLimit(clientKey: string): Promise&lt;boolean&gt; &#123;</span>
                    </div>
                    <div className="cr-code-diff__line cr-code-diff__line--ctx">
                      <span className="cr-line-num">41</span>
                      <span className="cr-line-content">    const windowSeconds = 60;</span>
                    </div>

                    {!fixApplied ? (
                      <>
                        <div className="cr-code-diff__line cr-code-diff__line--del">
                          <span className="cr-line-num">42</span>
                          <span className="cr-diff-sign">-</span>
                          <span className="cr-line-content">    const currentCount = await redis.incr(clientKey);</span>
                        </div>
                        <div className="cr-code-diff__line cr-code-diff__line--del">
                          <span className="cr-line-num">43</span>
                          <span className="cr-diff-sign">-</span>
                          <span className="cr-line-content">    if (currentCount === 1) await redis.expire(clientKey, windowSeconds);</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="cr-code-diff__line cr-code-diff__line--add">
                          <span className="cr-line-num">42</span>
                          <span className="cr-diff-sign">+</span>
                          <span className="cr-line-content">    // [CodeBuster Verified Fix]: Atomic Multi/Exec pipeline prevents TTL leak race</span>
                        </div>
                        <div className="cr-code-diff__line cr-code-diff__line--add">
                          <span className="cr-line-num">43</span>
                          <span className="cr-diff-sign">+</span>
                          <span className="cr-line-content">    const [[, currentCount]] = await redis.multi().incr(clientKey).expire(clientKey, windowSeconds, 'NX').exec();</span>
                        </div>
                      </>
                    )}

                    <div className="cr-code-diff__line cr-code-diff__line--ctx">
                      <span className="cr-line-num">44</span>
                      <span className="cr-line-content">    return Number(currentCount) &lt;= 100;</span>
                    </div>
                    <div className="cr-code-diff__line cr-code-diff__line--ctx">
                      <span className="cr-line-num">45</span>
                      <span className="cr-line-content">  &#125;</span>
                    </div>
                  </div>

                  {/* Speech pointer connecting line 42 to the AI review card */}
                  <div className="cr-speech-pointer-wrap">
                    <div className="cr-speech-pointer" />
                  </div>

                  {/* AI Inline Review Card */}
                  <div className="cr-ai-comment-card">
                    <div className="cr-ai-comment-card__header">
                      <div className="d-flex align-items-center gap-2">
                        <div className="cr-bot-avatar">
                          <RabbitIcon size={18} />
                        </div>
                        <div className="d-flex flex-column" style={{ lineHeight: 1.2 }}>
                          <span className="fw-bold" style={{ fontSize: '13px' }}>
                            CodeBuster AI <span className="cr-pill-sm cr-pill-sm--orange">Reviewer</span>
                          </span>
                          <span className="text-secondary" style={{ fontSize: '11px' }}>Just now · Confidence 99.4%</span>
                        </div>
                      </div>

                      <span className="cr-badge-chip cr-badge-chip--danger">
                        🔴 CRITICAL BUG (P0): Concurrency TTL Leak
                      </span>
                    </div>

                    <div className="cr-ai-comment-card__body">
                      <p>
                        <strong>Race condition identified (Time-of-Check to Time-of-Use):</strong> If worker crashes, times out,
                        or network drops between lines 42 and 43, the key remains indefinitely in Redis without an expiration TTL.
                        This will permanently lock out valid client requests once the threshold is crossed.
                      </p>
                      <p className="mb-2">
                        <strong>Remediation:</strong> Bundle <code className="cr-code-inline">INCR</code> and <code className="cr-code-inline">EXPIRE NX</code> in an atomic transaction pipeline.
                      </p>

                      {/* 1-Click Code Patch Comparison Box */}
                      <div className="cr-fix-box">
                        <div className="cr-fix-box__header">
                          <span className="cr-fix-box__title"><FaBolt size={11} /> Suggested 1-Click Replacement</span>
                          <span className="cr-pill-sm cr-pill-sm--green">Atomic Transaction</span>
                        </div>
                        <div className="cr-fix-box__diff">
                          <div className="cr-fix-line cr-fix-line--del">- await redis.expire(clientKey, windowSeconds);</div>
                          <div className="cr-fix-line cr-fix-line--add">{'+ const [[, currentCount]] = await redis.multi().incr(clientKey).expire(clientKey, windowSeconds, \'NX\').exec();'}</div>
                        </div>
                      </div>

                      <div className="cr-ai-comment-card__actions mt-3">
                        {!fixApplied ? (
                          <button className="cr-btn cr-btn--primary cr-btn--sm" onClick={handleApplyFix}>
                            <FaBolt size={12} /> Accept Fix &amp; Commit to Branch (+1)
                          </button>
                        ) : (
                          <div className="cr-fix-success">
                            <FaCheckCircle size={15} style={{ color: '#25E2A8' }} />
                            <span>
                              <strong>Patch Applied!</strong> Commit <code className="cr-code-inline">cb-7d1a9</code> created on branch <code className="cr-code-inline">feature/resilient-token-bucket</code>.
                            </span>
                          </div>
                        )}
                        <button className="cr-btn cr-btn--ghost cr-btn--sm" onClick={() => setActiveDemoTab('chat')}>
                          <FaCommentDots size={12} /> Ask CodeBuster in Chat
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SUMMARY & WALKTHROUGH */}
              {activeDemoTab === 'summary' && (
                <div className="cr-tab-pane">
                  <div className="cr-summary-block">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h4 className="m-0 fw-bold d-flex align-items-center gap-2" style={{ fontSize: '16px' }}>
                        <FaMagic size={14} style={{ color: '#FF570A' }} /> AI Pull Request Executive Summary
                      </h4>
                      <span className="cr-pill-sm cr-pill-sm--green">Low Impact Risk</span>
                    </div>

                    <p className="text-secondary" style={{ fontSize: '13.5px', lineHeight: 1.6 }}>
                      This PR refactors the ingress rate-limiting architecture to prevent distributed lock contention and token leaks.
                      It introduces atomic sliding-window transactions via Redis clusters, enhances unit test coverage to 94%, and implements
                      cryptographic HMAC header validation.
                    </p>

                    <h5 className="mt-4 mb-2 fw-bold text-white" style={{ fontSize: '14px' }}>Architectural Walkthrough by Layer</h5>
                    <div className="cr-walkthrough-layers">
                      <div className="cr-layer-card">
                        <div className="cr-layer-card__tag">API Gateway Ingress</div>
                        <div className="cr-layer-card__file"><code>src/api/gateway.ts</code></div>
                        <div className="cr-layer-card__desc">Extracted client fingerprint and added standardized RFC-6585 RateLimit headers.</div>
                      </div>
                      <div className="cr-layer-card">
                        <div className="cr-layer-card__tag">State &amp; Storage Engine</div>
                        <div className="cr-layer-card__file"><code>src/services/rateLimiter.ts</code></div>
                        <div className="cr-layer-card__desc">Replaced naive key incr with atomic Redis pipeline; eliminated TTL leak race.</div>
                      </div>
                      <div className="cr-layer-card">
                        <div className="cr-layer-card__tag">Security &amp; Auth</div>
                        <div className="cr-layer-card__file"><code>src/middleware/auth.ts</code></div>
                        <div className="cr-layer-card__desc">HMAC-SHA256 signature verification prior to cache state modification.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: VISUAL SEQUENCE FLOW */}
              {activeDemoTab === 'diagram' && (
                <div className="cr-tab-pane">
                  <div className="cr-sequence-diagram-box">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div>
                        <h4 className="m-0 fw-bold" style={{ fontSize: '15px' }}>Automated Architectural Sequence Flow</h4>
                        <span className="text-secondary" style={{ fontSize: '12px' }}>Synthesized from PR multi-file call tree</span>
                      </div>
                      <span className="cr-badge-chip cr-badge-chip--green">Latencies &lt; 1.2ms</span>
                    </div>

                    {/* Interactive Sequence Visualizer */}
                    <div className="cr-sequence-flow">
                      <div className="cr-sequence-node">
                        <div className="cr-node-icon"><FaUsers size={16} /></div>
                        <div className="cr-node-title">Client Request</div>
                        <div className="cr-node-meta">HTTP POST /v2/charge</div>
                      </div>
                      <div className="cr-sequence-arrow">
                        <div className="cr-arrow-line" />
                        <span className="cr-arrow-label">HMAC Signature</span>
                      </div>
                      <div className="cr-sequence-node cr-sequence-node--highlight">
                        <div className="cr-node-icon"><FaShieldAlt size={16} /></div>
                        <div className="cr-node-title">Auth Guard</div>
                        <div className="cr-node-meta">Verify Token</div>
                      </div>
                      <div className="cr-sequence-arrow">
                        <div className="cr-arrow-line" />
                        <span className="cr-arrow-label">Atomic Multi/Exec</span>
                      </div>
                      <div className="cr-sequence-node cr-sequence-node--accent">
                        <div className="cr-node-icon"><FaServer size={16} /></div>
                        <div className="cr-node-title">Redis Cluster</div>
                        <div className="cr-node-meta">Token Bucket (NX)</div>
                      </div>
                      <div className="cr-sequence-arrow">
                        <div className="cr-arrow-line" />
                        <span className="cr-arrow-label">200 OK Token Ok</span>
                      </div>
                      <div className="cr-sequence-node">
                        <div className="cr-node-icon"><FaCode size={16} /></div>
                        <div className="cr-node-title">Core Worker</div>
                        <div className="cr-node-meta">Execute Handler</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: AGENTIC CHAT DEMO */}
              {activeDemoTab === 'chat' && (
                <div className="cr-tab-pane">
                  <div className="cr-chat-workbench">
                    <div className="cr-chat-prompts mb-3">
                      <span className="text-secondary fw-semibold me-2" style={{ fontSize: '12px' }}>
                        Quick Prompts:
                      </span>
                      <button
                        className={`cr-prompt-pill ${activeChatKey === 'test' ? 'cr-prompt-pill--active' : ''}`}
                        onClick={() => setActiveChatKey('test')}
                      >
                        🧪 Generate Unit Tests
                      </button>
                      <button
                        className={`cr-prompt-pill ${activeChatKey === 'complexity' ? 'cr-prompt-pill--active' : ''}`}
                        onClick={() => setActiveChatKey('complexity')}
                      >
                        📊 Big-O Complexity
                      </button>
                      <button
                        className={`cr-prompt-pill ${activeChatKey === 'owasp' ? 'cr-prompt-pill--active' : ''}`}
                        onClick={() => setActiveChatKey('owasp')}
                      >
                        🛡️ OWASP Security Audit
                      </button>
                    </div>

                    <div className="cr-chat-thread">
                      <div className="cr-chat-msg cr-chat-msg--user">
                        <div className="cr-chat-msg__author">You (@sarah-architect)</div>
                        <div className="cr-chat-msg__text">{DEMO_CHAT_RESPONSES[activeChatKey].prompt}</div>
                      </div>

                      <div className="cr-chat-msg cr-chat-msg--bot">
                        <div className="cr-chat-msg__author d-flex align-items-center gap-2">
                          <RabbitIcon size={14} /> CodeBuster Autonomous Agent
                        </div>
                        <div className="cr-chat-msg__text">
                          <div dangerouslySetInnerHTML={{
                            __html: DEMO_CHAT_RESPONSES[activeChatKey].response
                              .replace(/### (.*)/g, '<h5 class="fw-bold mt-1 mb-2 text-white">$1</h5>')
                              .replace(/```typescript([\s\S]*?)```/g, '<pre class="cr-code-pre"><code>$1</code></pre>')
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\*(.*?)\*/g, '<em>$1</em>')
                              .replace(/`([^`]+)`/g, '<code class="cr-code-inline">$1</code>'),
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ==================== 4. SOCIAL PROOF & METRICS TICKER ==================== */}
      <section className="cr-metrics-section">
        <div className="cr-container">
          <div className="cr-metrics-grid">
            <div className="cr-metric-card">
              <div className="cr-metric-card__value">70%</div>
              <div className="cr-metric-card__label">Reduction in Review Turnaround</div>
            </div>
            <div className="cr-metric-card">
              <div className="cr-metric-card__value">2,500,000+</div>
              <div className="cr-metric-card__label">Pull Requests Reviewed to Date</div>
            </div>
            <div className="cr-metric-card">
              <div className="cr-metric-card__value">99.2%</div>
              <div className="cr-metric-card__label">Positive Finding Satisfaction Rate</div>
            </div>
            <div className="cr-metric-card">
              <div className="cr-metric-card__value">&lt; 30s</div>
              <div className="cr-metric-card__label">Average Time to Review Delivery</div>
            </div>
          </div>

          {/* Integration & Ecosystem Ticker */}
          <div className="cr-ecosystem-strip mt-5">
            <span className="cr-ecosystem-title">INTEGRATES WITH YOUR ENTIRE ENGINEERING TOOLCHAIN</span>
            <div className="cr-ecosystem-logos">
              <div className="cr-logo-item"><FaGithub size={22} /> <span>GitHub</span></div>
              <div className="cr-logo-item"><SiGitlab size={22} /> <span>GitLab</span></div>
              <div className="cr-logo-item"><SiTypescript size={20} /> <span>TypeScript</span></div>
              <div className="cr-logo-item"><SiPython size={20} /> <span>Python</span></div>
              <div className="cr-logo-item"><SiGo size={22} /> <span>Go</span></div>
              <div className="cr-logo-item"><SiRust size={22} /> <span>Rust</span></div>
              <div className="cr-logo-item"><SiDocker size={22} /> <span>Docker</span></div>
              <div className="cr-logo-item"><SiKubernetes size={22} /> <span>Kubernetes</span></div>
              <div className="cr-logo-item"><SiVercel size={20} /> <span>Vercel</span></div>
              <div className="cr-logo-item"><SiAmazonaws size={22} /> <span>AWS</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 5. BENTO GRID FEATURES ==================== */}
      <section id="features" className="cr-section">
        <div className="cr-container">
          <div className="cr-section__head text-center">
            <span className="cr-eyebrow">Capabilities</span>
            <h2 className="cr-section-title">Built for engineers who care about code craft</h2>
            <p className="cr-section-desc">
              Not another shallow regex linter. CodeBuster acts as an expert senior reviewer that understands your system architecture.
            </p>
          </div>

          <div className="cr-bento-grid">
            {BENTO_FEATURES.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className={`cr-bento-card ${item.wide ? 'cr-bento-card--wide' : ''}`}>
                  <div className="cr-bento-card__top">
                    <div
                      className="cr-bento-icon"
                      style={{
                        background: `${item.accent}1A`,
                        borderColor: `${item.accent}40`,
                        color: item.accent,
                      }}
                    >
                      <Icon size={20} />
                    </div>
                    <span className="cr-badge-chip">{item.badge}</span>
                  </div>

                  <h3 className="cr-bento-card__title">{item.title}</h3>
                  <p className="cr-bento-card__desc">{item.desc}</p>

                  <div className="mt-auto pt-3">
                    {item.preview}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== 6. HOW IT WORKS WORKFLOW ==================== */}
      <section id="how" className="cr-section cr-section--alt">
        <div className="cr-container">
          <div className="cr-section__head text-center">
            <span className="cr-eyebrow">Zero Friction Workflow</span>
            <h2 className="cr-section-title">From GitHub login to protected code in 60 seconds</h2>
            <p className="cr-section-desc">No YAML pipeline modifications. No CI runner bills. No waiting.</p>
          </div>

          <div className="cr-workflow-steps">
            <div className="cr-workflow-card">
              <div className="cr-step-num-ring">01</div>
              <h3 className="cr-step-title">Connect with 1 Click</h3>
              <p className="cr-step-desc">
                Sign in with GitHub and select your target repositories. CodeBuster sets up secure webhook listeners in seconds.
              </p>
              <div className="cr-step-tag">Zero Configuration</div>
            </div>

            <div className="cr-workflow-card">
              <div className="cr-step-num-ring">02</div>
              <h3 className="cr-step-title">Push Code or Open a PR</h3>
              <p className="cr-step-desc">
                Every commit is analyzed in parallel across security, architecture, performance, and dead code in under 30 seconds.
              </p>
              <div className="cr-step-tag">Multi-Agent Swarm</div>
            </div>

            <div className="cr-workflow-card">
              <div className="cr-step-num-ring">03</div>
              <h3 className="cr-step-title">Merge with Verified Confidence</h3>
              <p className="cr-step-desc">
                Receive prioritized inline GitHub comments, generate unit tests in PR chat, and commit verified one-click fixes.
              </p>
              <div className="cr-step-tag">1-Click Auto-Fix</div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 7. COMPARISON TABLE ==================== */}
      <section id="compare" className="cr-section">
        <div className="cr-container">
          <div className="cr-section__head text-center">
            <span className="cr-eyebrow">How We Compare</span>
            <h2 className="cr-section-title">Why teams migrate to CodeBuster</h2>
            <p className="cr-section-desc">See how CodeBuster compares to legacy linters and generic chat models.</p>
          </div>

          <div className="cr-comparison-wrapper">
            <table className="cr-comparison-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th className="cr-col-codebuster">
                    <div className="cr-col-highlight-badge">RECOMMENDED</div>
                    <div className="d-flex align-items-center justify-content-center gap-2">
                      <RabbitIcon size={20} /> CodeBuster
                    </div>
                  </th>
                  <th>SonarQube / ESLint</th>
                  <th>Generic ChatGPT</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i}>
                    <td className="fw-semibold">{row.feature}</td>
                    <td className="cr-col-codebuster">
                      {row.codebuster === true ? (
                        <span className="cr-check-icon"><FaCheck size={14} /></span>
                      ) : (
                        row.codebuster
                      )}
                    </td>
                    <td>
                      {row.sonar === false ? (
                        <span className="cr-cross-icon"><FaTimes size={13} /></span>
                      ) : (
                        <span className="text-secondary">{row.sonar}</span>
                      )}
                    </td>
                    <td>
                      {row.chatgpt === false ? (
                        <span className="cr-cross-icon"><FaTimes size={13} /></span>
                      ) : (
                        <span className="text-secondary">{row.chatgpt}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ==================== 8. ENTERPRISE TRUST & SECURITY ==================== */}
      <section id="security" className="cr-section cr-section--alt">
        <div className="cr-container">
          <div className="cr-security-banner">
            <div className="cr-security-content">
              <span className="cr-eyebrow" style={{ color: '#25E2A8' }}>Enterprise Grade Security</span>
              <h2 className="cr-security-title">Your code is your IP. We never train on it.</h2>
              <p className="cr-security-desc">
                We know your source code represents your company’s most sensitive competitive advantage.
                CodeBuster was architected from day one with strict zero-retention principles and hardened compliance.
              </p>

              <div className="cr-security-grid">
                <div className="cr-sec-item">
                  <div className="cr-sec-icon"><FaLock size={16} /></div>
                  <div>
                    <h5 className="cr-sec-heading">Zero Data Retention</h5>
                    <p className="cr-sec-text">Diffs are parsed in ephemeral memory-isolated containers and immediately discarded.</p>
                  </div>
                </div>

                <div className="cr-sec-item">
                  <div className="cr-sec-icon"><FaShieldAlt size={16} /></div>
                  <div>
                    <h5 className="cr-sec-heading">SOC 2 Type II Certified</h5>
                    <p className="cr-sec-text">Audited security controls, independent penetration testing, and continuous compliance monitoring.</p>
                  </div>
                </div>

                <div className="cr-sec-item">
                  <div className="cr-sec-icon"><FaCode size={16} /></div>
                  <div>
                    <h5 className="cr-sec-heading">End-to-End Encryption</h5>
                    <p className="cr-sec-text">All network traffic encrypted with TLS 1.3; GitHub OAuth tokens stored via Fernet AES-256.</p>
                  </div>
                </div>

                <div className="cr-sec-item">
                  <div className="cr-sec-icon"><FaServer size={16} /></div>
                  <div>
                    <h5 className="cr-sec-heading">Self-Hosted / VPC Options</h5>
                    <p className="cr-sec-text">Deploy worker agents in your own air-gapped AWS, Azure, or GCP infrastructure.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 9. PRICING ==================== */}
      <section id="pricing" className="cr-section">
        <div className="cr-container">
          <div className="cr-section__head text-center">
            <span className="cr-eyebrow">Transparent Pricing</span>
            <h2 className="cr-section-title">Invest in speed, not review bottlenecks</h2>
            <p className="cr-section-desc">Free forever for open source. Simple per-seat pricing for commercial teams.</p>

            {/* Billing Toggle */}
            <div className="cr-billing-toggle mt-4">
              <button
                className={`cr-toggle-btn ${billingCycle === 'monthly' ? 'cr-toggle-btn--active' : ''}`}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly
              </button>
              <button
                className={`cr-toggle-btn ${billingCycle === 'annual' ? 'cr-toggle-btn--active' : ''}`}
                onClick={() => setBillingCycle('annual')}
              >
                Annual <span className="cr-pill-sm cr-pill-sm--green ms-1">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="cr-pricing-grid">
            {/* Free Tier */}
            <div className="cr-pricing-card">
              <div className="cr-pricing-card__name">Community</div>
              <div className="cr-pricing-card__desc">For open-source maintainers and indie hackers.</div>
              <div className="cr-pricing-card__price">
                <span className="cr-price-num">$0</span>
                <span className="cr-price-period">/ forever</span>
              </div>
              <button className="cr-btn cr-btn--glass w-100 mb-4" onClick={handleLogin}>
                Sign Up Free
              </button>
              <ul className="cr-pricing-features">
                <li><FaCheck size={12} /> Unlimited public repositories</li>
                <li><FaCheck size={12} /> Automated PR summaries</li>
                <li><FaCheck size={12} /> Basic security vulnerability scanning</li>
                <li><FaCheck size={12} /> GitHub comment integration</li>
                <li><FaCheck size={12} /> Community Discord support</li>
              </ul>
            </div>

            {/* Pro Tier (Featured) */}
            <div className="cr-pricing-card cr-pricing-card--featured">
              <div className="cr-featured-badge">MOST POPULAR</div>
              <div className="cr-pricing-card__name">Pro Team</div>
              <div className="cr-pricing-card__desc">For high-velocity startups and scaling teams.</div>
              <div className="cr-pricing-card__price">
                <span className="cr-price-num">{billingCycle === 'annual' ? '$15' : '$19'}</span>
                <span className="cr-price-period">/ dev / month</span>
              </div>
              <button className="cr-btn cr-btn--primary w-100 mb-4" onClick={handleLogin}>
                Start 14-Day Free Trial
              </button>
              <ul className="cr-pricing-features">
                <li><FaCheck size={12} /> <strong>Everything in Community, plus:</strong></li>
                <li><FaCheck size={12} /> Unlimited private GitHub &amp; GitLab repos</li>
                <li><FaCheck size={12} /> <strong>1-Click Verified Code Fixes</strong></li>
                <li><FaCheck size={12} /> <strong>Automated Sequence Diagrams</strong></li>
                <li><FaCheck size={12} /> Interactive PR chat &amp; unit test generator</li>
                <li><FaCheck size={12} /> Constellation 3D blast-radius mapping</li>
                <li><FaCheck size={12} /> Custom team styleguide &amp; rule presets</li>
                <li><FaCheck size={12} /> Priority multi-agent execution queue</li>
              </ul>
            </div>

            {/* Enterprise Tier */}
            <div className="cr-pricing-card">
              <div className="cr-pricing-card__name">Enterprise</div>
              <div className="cr-pricing-card__desc">For organizations with strict governance and security.</div>
              <div className="cr-pricing-card__price">
                <span className="cr-price-num">Custom</span>
                <span className="cr-price-period">/ annual contract</span>
              </div>
              <button className="cr-btn cr-btn--glass w-100 mb-4" onClick={handleLogin}>
                Contact Sales
              </button>
              <ul className="cr-pricing-features">
                <li><FaCheck size={12} /> <strong>Everything in Pro, plus:</strong></li>
                <li><FaCheck size={12} /> Self-hosted worker runners &amp; VPC deploy</li>
                <li><FaCheck size={12} /> SOC 2 Type II audit packages</li>
                <li><FaCheck size={12} /> SAML 2.0 Single Sign-On (SSO)</li>
                <li><FaCheck size={12} /> Custom LLM model fine-tuning</li>
                <li><FaCheck size={12} /> 99.9% Uptime SLA guarantee</li>
                <li><FaCheck size={12} /> Dedicated technical account manager</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 10. TESTIMONIALS ==================== */}
      <section className="cr-section cr-section--alt">
        <div className="cr-container">
          <div className="cr-section__head text-center">
            <span className="cr-eyebrow">Loved by Engineers</span>
            <h2 className="cr-section-title">Trusted by engineering teams across the globe</h2>
          </div>

          <div className="cr-testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="cr-testimonial-card">
                <FaQuoteLeft size={20} className="cr-quote-icon mb-3" />
                <p className="cr-testimonial-quote">"{t.quote}"</p>
                <div className="cr-testimonial-author">
                  <img src={t.avatar} alt={t.author} className="cr-avatar" />
                  <div>
                    <div className="cr-author-name">{t.author}</div>
                    <div className="cr-author-role">{t.role}</div>
                  </div>
                  <span className="cr-testimonial-stat">{t.stat}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 11. FAQ ACCORDION ==================== */}
      <section id="faq" className="cr-section">
        <div className="cr-container" style={{ maxWidth: '820px' }}>
          <div className="cr-section__head text-center">
            <span className="cr-eyebrow">Got Questions?</span>
            <h2 className="cr-section-title">Frequently Asked Questions</h2>
          </div>

          <div className="cr-faq-list">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={index} className={`cr-faq-item ${isOpen ? 'cr-faq-item--open' : ''}`}>
                  <button className="cr-faq-trigger" onClick={() => setOpenFaq(isOpen ? null : index)}>
                    <span>{faq.q}</span>
                    {isOpen ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
                  </button>
                  {isOpen && (
                    <div className="cr-faq-answer">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== 12. HIGH-CONVERSION BOTTOM CTA ==================== */}
      <section className="cr-cta-banner-section">
        <div className="cr-container">
          <div className="cr-cta-banner">
            <div className="cr-cta-banner__glow" aria-hidden="true" />
            <div className="cr-cta-banner__content text-center">
              <div className="mb-3">
                <RabbitIcon size={52} className="cr-pulse-glow" />
              </div>
              <h2 className="cr-cta-banner__title">
                Stop waiting for reviews.<br />
                Start shipping with CodeBuster today.
              </h2>
              <p className="cr-cta-banner__desc">
                Join thousands of engineering teams saving hours every week.
                Connect a repository in under a minute with zero CI configuration.
              </p>
              <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
                <button className="cr-btn cr-btn--primary cr-btn--xl" onClick={handleLogin} disabled={isLoading || isDemoLoading}>
                  <FaGithub size={20} /> Sign in with GitHub Free
                </button>
                <button className="cr-btn cr-btn--glass cr-btn--xl" onClick={handleDemoLogin} disabled={isLoading || isDemoLoading}>
                  {isDemoLoading ? <Spinner size="sm" animation="border" /> : 'Launch Demo Workspace'}
                </button>
              </div>
              <div className="cr-cta-banner__note mt-3">
                Free for public repositories · No credit card required · Read access only
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 13. DEVELOPER FOOTER ==================== */}
      <footer className="cr-footer">
        <div className="cr-container">
          <div className="cr-footer__top">
            <div className="cr-footer__brand-col">
              <BrandLogo size={26} />
              <p className="cr-footer__mission mt-3">
                CodeBuster provides autonomous AI code reviews, PR triage, architectural sequence flows, and verified one-click fixes for modern engineering teams.
              </p>
              <div className="cr-status-indicator mt-3">
                <span className="cr-status-dot" /> All Systems Operational (99.99%)
              </div>
            </div>

            <div className="cr-footer__links-col">
              <h6>Product</h6>
              <button onClick={() => scrollTo('demo')}>Interactive Demo</button>
              <button onClick={() => scrollTo('features')}>Features</button>
              <button onClick={() => scrollTo('how')}>How It Works</button>
              <button onClick={() => scrollTo('compare')}>Comparison</button>
              <button onClick={() => scrollTo('pricing')}>Pricing</button>
            </div>

            <div className="cr-footer__links-col">
              <h6>Architecture</h6>
              <span className="cr-footer-link-disabled">AST Indexing Engine</span>
              <span className="cr-footer-link-disabled">Sequence Visualizer</span>
              <span className="cr-footer-link-disabled">Constellation Maps</span>
              <span className="cr-footer-link-disabled">Time Travel Audit</span>
            </div>

            <div className="cr-footer__links-col">
              <h6>Security &amp; Trust</h6>
              <button onClick={() => scrollTo('security')}>Zero Retention Policy</button>
              <button onClick={() => scrollTo('security')}>SOC 2 Type II</button>
              <span className="cr-footer-link-disabled">Privacy Architecture</span>
              <span className="cr-footer-link-disabled">Subprocessors</span>
            </div>

            <div className="cr-footer__links-col">
              <h6>Resources</h6>
              <button onClick={() => scrollTo('faq')}>FAQ</button>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                GitHub App <FaExternalLinkAlt size={10} className="ms-1" />
              </a>
              <span className="cr-footer-link-disabled">Documentation</span>
              <span className="cr-footer-link-disabled">Changelog</span>
            </div>
          </div>

          <div className="cr-footer__bottom">
            <div>
              &copy; {new Date().getFullYear()} CodeBuster Inc. All rights reserved.
            </div>
            <div className="d-flex align-items-center gap-4">
              <span className="cr-footer-link-disabled">Privacy Policy</span>
              <span className="cr-footer-link-disabled">Terms of Service</span>
              <span className="cr-footer-link-disabled">Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
