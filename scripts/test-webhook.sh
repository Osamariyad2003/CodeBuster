#!/usr/bin/env bash
# Send a test GitHub webhook (push event) to the local backend.
# Usage: ./scripts/test-webhook.sh [BASE_URL]
# Requires: GITHUB_WEBHOOK_SECRET set in .env or pass signature manually for dev.
set -e
BASE="${1:-http://localhost:8000}"
SECRET="${GITHUB_WEBHOOK_SECRET:-dev-webhook-secret}"

# Minimal push event payload (repository full_name and commit sha)
PAYLOAD='{"repository":{"full_name":"test-org/test-repo","default_branch":"main"},"ref":"refs/heads/main","after":"abc123def456"}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')

echo "POST $BASE/webhooks/github (X-GitHub-Event: push)"
curl -s -X POST "$BASE/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-delivery-$(date +%s)" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$PAYLOAD" | jq .

echo ""
echo "Check reviews: curl -s $BASE/api/reviews | jq ."
