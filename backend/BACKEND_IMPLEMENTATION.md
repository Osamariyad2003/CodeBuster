# CodeBuster Backend Implementation

## Overview

Complete backend implementation based on the design documents. This follows the MVP plan with SQLite database, Security and Code Quality analyzers, and GPT-4 AI integration.

## Structure

```
backend/
├── app.py                      # Flask application entry point
├── config.py                   # Configuration
├── requirements.txt            # Dependencies
├── models/                     # Database models
│   ├── __init__.py
│   ├── database.py            # Database initialization
│   ├── user.py                # User model
│   ├── repository.py          # Repository model
│   ├── review.py              # Review model
│   ├── issue.py               # Issue model
│   └── feedback.py            # Feedback model
├── services/                   # Analysis services
│   ├── __init__.py
│   ├── security_analyzer.py   # Security analysis
│   ├── code_quality_analyzer.py # Code quality analysis
│   ├── ai_review_service.py   # GPT-4 AI integration
│   └── review_orchestrator.py  # Orchestrates all analyzers
├── routes/                     # API routes
│   ├── auth.py                # Authentication (OAuth)
│   ├── github.py              # GitHub webhooks & repos
│   ├── review.py              # Review endpoints
│   └── feedback.py            # Feedback endpoints
└── utils/                      # Utilities
    ├── ai_review.py           # Legacy (can be removed)
    └── github_comment.py      # GitHub comment formatting
```

## Features Implemented

### 1. Database Models (SQLite for MVP)

- **User**: GitHub OAuth users
- **Repository**: Connected GitHub repositories
- **Review**: Analysis reviews (one per PR)
- **Issue**: Individual findings/issues
- **Feedback**: User feedback (accept/dismiss/resolve)

### 2. Analyzers

#### Security Analyzer
- Detects hardcoded secrets (API keys, tokens, passwords)
- SQL injection vulnerabilities
- XSS vulnerabilities (for web files)
- Pattern-based detection with confidence scoring

#### Code Quality Analyzer
- File length checks
- Code smells (TODO, FIXME, print statements)
- Style issues (magic numbers)
- Complexity analysis (nesting depth)

### 3. AI Review Service

- **GPT-4 Integration**: Uses OpenAI API for issue prioritization and explanation
- **Fallback**: Rule-based review when API key not available
- **Output Format**: Structured JSON matching design schema
- **Confidence Scoring**: Calculates confidence based on evidence

### 4. Review Orchestrator

- Coordinates all analyzers
- Aggregates findings
- Deduplicates issues
- Calls AI service for reasoning
- Formats final output

### 5. API Routes

#### `/api/review`
- `POST /api/review` - Manual code review
- `GET /api/review/<review_id>` - Get review details
- `GET /api/review/repository/<repo_id>` - Get all reviews for repo
- `GET /api/review/pr/<owner>/<repo>/<pr_number>` - Get PR review

#### `/api/feedback`
- `POST /api/feedback` - Submit feedback on issue
- `GET /api/feedback/issue/<issue_id>` - Get feedback for issue

#### `/github/webhook`
- `POST /github/webhook` - GitHub webhook handler
  - Handles PR events (opened, synchronized)
  - Fetches PR files
  - Runs analysis
  - Posts inline comments to GitHub

## Configuration

### Environment Variables

Create `.env` file in `backend/` directory:

```env
# Flask
FLASK_SECRET_KEY=your-secret-key-here
FRONTEND_URL=http://localhost:5173

# GitHub OAuth
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret

# GitHub App (for webhooks)
GITHUB_APP_ID=your-app-id
GITHUB_APP_PRIVATE_KEY_PATH=path/to/private-key.pem
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_ACCESS_TOKEN=your-access-token

# OpenAI (optional, falls back to rule-based if not set)
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview

# Database (optional, defaults to SQLite)
DATABASE_URL=sqlite:///codebuster.db
```

## Installation

1. **Install dependencies**:
```bash
cd backend
pip install -r requirements.txt
```

2. **Set up environment variables**:
```bash
cp config_template.env .env
# Edit .env with your credentials
```

3. **Run the application**:
```bash
python app.py
```

The backend will:
- Initialize SQLite database (creates `codebuster.db`)
- Start Flask server on `http://127.0.0.1:5000`

## API Usage Examples

### Manual Code Review

```bash
curl -X POST http://localhost:5000/api/review \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "path": "src/api.py",
        "content": "API_KEY = \"sk_live_1234567890\""
      }
    ]
  }'
```

### Get Review

```bash
curl http://localhost:5000/api/review/<review_id>
```

### Submit Feedback

```bash
curl -X POST http://localhost:5000/api/feedback \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "issue_id": "issue-001",
    "review_id": "review-001",
    "action": "accept",
    "comment": "Good catch!"
  }'
```

## GitHub Webhook Setup

1. **Create GitHub App** at https://github.com/settings/apps/new
2. **Set webhook URL**: `http://your-domain:5000/github/webhook`
3. **Enable permissions**: Contents (read), Pull Requests (read & write)
4. **Subscribe to events**: Pull request, Push
5. **Generate private key** and save to file
6. **Configure `.env`** with app credentials

## Database Schema

The SQLite database includes:

- `users` - GitHub OAuth users
- `repositories` - Connected repos
- `reviews` - Analysis reviews
- `issues` - Individual findings
- `feedback` - User feedback

See `DATABASE_SCHEMA.md` for complete schema.

## Next Steps (V1)

To upgrade to V1:

1. **Upgrade to PostgreSQL**
   - Change `DATABASE_URL` in `.env`
   - Run migrations

2. **Add Job Queue**
   - Install Celery + Redis
   - Move analysis to async tasks

3. **Add More Analyzers**
   - Performance analyzer
   - Maintainability analyzer
   - DevOps analyzer
   - Frontend DevTools analyzer

4. **Add RAG System**
   - Set up ChromaDB
   - Index repository docs
   - Enhance AI prompts with context

5. **Add ML Models**
   - Train priority classifier
   - Train acceptance predictor
   - Integrate with review pipeline

## Testing

Run basic tests:

```bash
# Test health endpoint
curl http://localhost:5000/health

# Test review endpoint
curl -X POST http://localhost:5000/api/review \
  -H "Content-Type: application/json" \
  -d '{"files": [{"path": "test.py", "content": "print(\"test\")"}]}'
```

## Troubleshooting

### Database errors
- Ensure SQLite file is writable
- Check database path in `DATABASE_URL`

### OpenAI API errors
- Check `OPENAI_API_KEY` is set
- System will fall back to rule-based review if API fails

### GitHub webhook errors
- Verify webhook signature secret matches
- Check `GITHUB_ACCESS_TOKEN` has correct permissions
- Ensure webhook URL is accessible

## Notes

- **MVP Implementation**: This is the MVP version. For production, upgrade to PostgreSQL and add job queue.
- **Synchronous Processing**: Analysis runs synchronously. For large repos, consider timeout limits.
- **Basic Analyzers**: Security and Code Quality only. More analyzers in V1.
- **No RAG**: AI uses simple prompts. RAG system in V1.
- **No ML**: Uses rule-based prioritization. ML models in V1.

