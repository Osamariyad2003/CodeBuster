# GitHub Webhook Ingestor (FastAPI)

A high-performance, secure ingestion layer for GitHub webhooks.

## Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Environment Variables**:
   Create a `.env` file or export the following:
   ```bash
   GITHUB_WEBHOOK_SECRET=your_secret_here
   REDIS_URL=redis://localhost:6379
   ```

3. **Run the Service**:
   ```bash
   uvicorn main:app --reload
   ```

## Features
- **HMAC SHA-256 Verification**: Ensures requests originate from GitHub.
- **Rate Limiting**: 60 requests/minute per IP via Redis.
- **Payload Size Limit**: Rejects payloads over 2MB (413).
- **Structured Logging**: JSON logs for easy ingestion by ELK/Datadog.
- **Request ID Tracking**: Correlation IDs across all logs.

## Testing
Run the test suite:
```bash
pytest tests/test_webhook.py
```
