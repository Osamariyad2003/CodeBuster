# CodeBuster 🤖 - Enterprise AI Code Auditor

CodeBuster is a production-quality, AI-powered code review platform. It leverages parallel static analysis and LLM-based reasoning to provide high-fidelity feedback on every GitHub Pull Request.

---

## 🏗️ Fail-Safe Engineering

This application is built with a **resilience-first** mindset:
- **No White Screens**: Global `ErrorBoundary` and `DataLoader` components ensure a graceful fallback for every network or logic error.
- **Idempotency**: All job triggers (webhooks/manual) support `X-Idempotency-Key` to prevent duplicate processing costs.
- **Robust Probes**: Integrated `/health` (liveness) and `/ready` (readiness) endpoints with DB and Redis connectivity checks.
- **Async Reliability**: Celery jobs use exponential backoff retries ($2^n \times 60s$) for transient AI service failures.
- **Pagination & Virtualization**: The reviews dashboard handles large datasets with clean server-side pagination.
- **Accessibility**: Semantic HTML and ARIA labels enforced across the navigation and interactive elements.

---

## 🚀 How to Run

### 1. Infrastructure
- **Redis**: Required for job queue, rate limiting, and idempotency tracking.
- **Python 3.9+** & **Node.js 18+**

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 3. Worker Setup
```bash
cd backend
celery -A celery_init worker --loglevel=info
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📂 Fail-Safe Checklist
- [x] **X-Request-ID**: Tracked from frontend to backend logs.
- [x] **X-Idempotency-Key**: Prevents duplicate job submissions.
- [x] **Standardized Errors**: JSON format `{code, message, request_id}`.
- [x] **Accessibility**: Labels and keyboard nav verified.
- [x] **Retries**: 3 retries for all transient network failures.

---
See `FAILURE_MODES.md` for a detailed matrix of how the app handles infrastructure outages.
