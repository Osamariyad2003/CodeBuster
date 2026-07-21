# CodeBuster - AI-Powered Code Review Platform

## Overview

CodeBuster is an **AI-powered engineering health analysis platform** that provides automated, intelligent code reviews for GitHub repositories. It combines static analysis, security scanning, and AI-powered insights to help development teams maintain code quality, identify vulnerabilities, and improve overall engineering practices.

## Core Features

### 🔍 Automated Code Analysis
- **Multi-dimensional review**: Architecture, Code Quality, Security, Performance, Reliability
- **Priority-based issue detection**: Critical, Major, and Minor severity levels
- **Confidence scoring**: AI-powered confidence ratings for each finding
- **Category-based scoring**: 10+ categories including DevOps, Observability, and Data Quality

### 🔗 GitHub Integration
- **OAuth Authentication**: Secure GitHub login flow
- **Webhook Support**: Automated reviews on pull requests and pushes
- **GitHub App Integration**: Install on repositories for continuous monitoring
- **Inline PR Comments**: Automatic issue reporting directly on GitHub pull requests

### 📊 Dashboard & Monitoring
- **Real-time health metrics**: Overall health score, issue counts, and trends
- **Repository management**: Connect/disconnect repositories with one click
- **Review history**: Historical view of all code reviews and their outcomes
- **Event tracking**: Monitor webhook events and analysis job queues

### 🛡️ Security & Production-Ready
- **Encrypted token storage**: Fernet encryption for GitHub access tokens
- **Debug mode disabled**: Production-safe Flask configuration
- **Rate limiting**: Protection against webhook spam
- **Idempotency**: Prevents duplicate processing of GitHub events

## Technology Stack

### Backend
- **Framework**: Flask (Python 3.9+)
- **Database**: PostgreSQL 15 (with SQLite fallback for development)
- **Task Queue**: Celery with Redis
- **ORM**: SQLAlchemy
- **API**: RESTful JSON endpoints

### Frontend
- **Framework**: React 18 with Vite
- **Routing**: React Router v6
- **UI Library**: React Bootstrap
- **Icons**: React Icons (Font Awesome)
- **State Management**: Context API (AuthContext)

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose
- **CI/CD Ready**: Production Dockerfile with gunicorn

## Recent Enhancements (February 2026)

### 🎨 UI/UX Improvements

#### 1. Modern Dashboard Design
- **Health Score Overview**: Large, prominent health score indicator with color-coded status
- **Stat Cards**: Interactive metric cards for Health, Confidence, Issues, Events, and Jobs
- **Trend Visualization**: 7-day health trend chart with smooth line graphs
- **Responsive Layout**: Mobile-first design with Bootstrap grid system

#### 2. Enhanced Repository Page
- **Repository Cards**: Beautiful card-based layout for connected repositories
- **Status Badges**: Active/Paused/Disconnected status indicators
- **Quick Actions**: Direct links to GitHub, Commits, and Settings
- **Health Score Display**: Color-coded health scores (Green: 70+, Orange: 50-69, Red: <50)
- **Empty State**: Engaging UI when no repositories are connected

#### 3. GitHub Connection Flow
- **Two-Tab Interface**: "My Connected Repos" and "Add New (All Repos)"
- **Search Functionality**: Real-time filtering of repositories
- **User Profile Display**: Avatar, username, and online status
- **Installation Wizard**: Simplified GitHub App installation process

#### 4. Component Library
- **ConfidenceBadge**: Color-coded confidence indicators (High/Medium/Low)
- **HealthTrendChart**: Interactive Recharts-based visualization
- **Toast Notifications**: Context-based success/error messages
- **Loading States**: Skeleton loaders and spinners for better UX

#### 5. Design System
- **Color Palette**:
  - Primary Brand: `#4F46E5` (Indigo)
  - Success: `#10B981` (Green)
  - Warning: `#F59E0B` (Amber)
  - Danger: `#EF4444` (Red)
  - Info: `#06B6D4` (Cyan)
- **Typography**: System fonts with -0.02em letter spacing for headlines
- **Border Radius**: Consistent 12px for cards, 8px for buttons
- **Shadows**: Subtle elevation with `0 1px 3px rgba(0,0,0,0.02)`

### 🔒 Security Enhancements
1. **Token Encryption**: Fernet-based encryption for GitHub access/refresh tokens
2. **Debug Mode Control**: Environment-based debug configuration (default: False)
3. **Session Security**: Minimal user data stored in sessions
4. **HTTPS-Ready**: Production configuration for secure deployments

### 🏗️ Architecture Improvements
1. **PostgreSQL Migration**: Default database changed from SQLite to PostgreSQL
2. **Docker Support**: Multi-stage Dockerfile with production optimizations
3. **Modular Routes**: Separated concerns (auth, repos, metrics, github)
4. **API Client**: Centralized `apiClient.js` with error handling
5. **Custom Hooks**: `usePolling`, `useCache` for efficient data fetching

### 🐛 Bug Fixes
- ✅ Fixed authentication flow to return JSON instead of redirect
- ✅ Resolved React error #130 (undefined Header component)
- ✅ Fixed broken Repository page routing
- ✅ Ensured all dashboard buttons are functional

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 16+
- PostgreSQL 15 (or use SQLite with env var)
- Redis (optional, for Celery)

### Quick Start

#### Using Docker (Recommended)
```bash
# Configure environment variables
cp .env.example .env
# Edit .env with your GitHub credentials

# Start all services
docker-compose up --build

# Access the app
# Frontend: http://localhost:5173
# Backend: http://localhost:5000
```

#### Local Development
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Use SQLite for development
$env:DATABASE_URL="sqlite:///codebuster.db"  # PowerShell
export DATABASE_URL="sqlite:///codebuster.db"  # Bash

python main.py

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Environment Variables
```env
# Required
FLASK_SECRET_KEY=your-secret-key-here
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-secret
FRONTEND_URL=http://localhost:5173

# Optional
DATABASE_URL=postgresql://user:pass@localhost:5432/codebuster
REDIS_URL=redis://localhost:6379/0
DEBUG=False
```

## API Endpoints

### Authentication
- `GET /auth/login` - Initiate GitHub OAuth
- `GET /auth/callback` - OAuth callback handler
- `POST /auth/logout` - Logout user

### Repositories
- `GET /api/repos` - List connected repositories
- `GET /api/repos/<repo_id>` - Repository details
- `GET /api/repos/<repo_id>/stats` - Repository statistics
- `POST /api/repos/<repo_id>/scan` - Trigger manual scan

### Metrics & Monitoring
- `GET /api/monitoring/summary` - Dashboard metrics
- `GET /api/metrics/health-trend` - Health trend data
- `GET /api/events` - Webhook event log
- `GET /api/jobs` - Analysis job queue

### GitHub Integration
- `GET /github/repos` - Fetch user's GitHub repositories
- `POST /github/connect` - Connect a repository
- `POST /github/disconnect` - Disconnect a repository
- `GET /api/github/install-url` - Get GitHub App installation URL

## Project Structure

```
CodeBuster/
├── backend/
│   ├── main.py              # Flask application entry point
│   ├── models/              # SQLAlchemy models
│   │   ├── database.py      # DB initialization
│   │   └── user.py          # User model with encryption
│   ├── routes/              # API routes
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── repos.py         # Repository management
│   │   ├── metrics.py       # Monitoring & stats
│   │   └── github.py        # GitHub integration
│   ├── services/            # Business logic
│   │   └── review_orchestrator.py
│   └── utils/               # Utilities
│       ├── encryption.py    # Token encryption
│       └── config_loader.py # Configuration
├── frontend/
│   ├── src/
│   │   ├── pages/           # Page components
│   │   │   ├── RepositoriesPage.jsx
│   │   │   └── RepositoryDashboard.jsx
│   │   ├── components/      # Reusable components
│   │   │   ├── ConfidenceBadge.jsx
│   │   │   ├── HealthTrendChart.jsx
│   │   │   └── ToastProvider.jsx
│   │   ├── lib/             # Utilities
│   │   │   └── apiClient.js # API client
│   │   ├── hooks/           # Custom hooks
│   │   │   └── usePolling.js
│   │   ├── AuthContext.jsx  # Auth state management
│   │   ├── Dashboard.jsx    # Main dashboard
│   │   └── Home.jsx         # Landing page
│   └── package.json
├── Dockerfile               # Production container
├── docker-compose.yml       # Multi-service orchestration
└── docs/                    # Documentation
    ├── REVIEW_AND_MODERNIZATION_SPEC.md
    └── PRODUCTION_READY_GITHUB_INTEGRATION.md
```

## Roadmap

### Phase 4: Optimization & Features (Next)
- [ ] Async/parallel review orchestration
- [ ] Structured logging with `structlog`
- [ ] Integration with Bandit/Semgrep CLI
- [ ] RAG/Vector DB for AI-enhanced analysis
- [ ] Custom rule configuration per repository
- [ ] Slack/Discord notifications
- [ ] Advanced metrics and analytics
- [ ] Multi-language support (i18n)

## Contributing

We welcome contributions! Please see our contributing guidelines for:
- Code style requirements
- Pull request process
- Testing standards
- Documentation updates

## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: See `/docs` directory
- **Issues**: GitHub Issues
- **Security**: Report security issues to security@codebuster.ai

---

**Last Updated**: February 9, 2026  
**Version**: 2.0.0 (Modernized UI & Production-Ready)  
**Status**: ✅ Production-Ready with PostgreSQL, Docker, and Enhanced UI
