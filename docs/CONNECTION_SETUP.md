# CodeBuster - Connection Setup Guide

## Overview
This guide ensures the GitHub App connection flow is properly configured and working.

## Connection Flow

### 1. User Authentication (OAuth)
- **Frontend**: User clicks "Sign in with GitHub" → redirects to GitHub OAuth
- **Backend**: `/auth/github` → `/auth/callback` → creates/updates user in DB
- **Session**: Stores user info + OAuth access token

### 2. Repository Connection
- **Frontend**: User clicks "Connect" on a repository
- **Backend**: `/github/connect` → saves repository to DB with `connected_by` = user.id
- **Result**: Repository is linked to user and initial scan is triggered

### 3. Repository Listing
- **Frontend**: Fetches repos from `/github/repos` (all available) and `/github/connected-repos` (connected)
- **Backend**: Returns repos with `is_connected` flag

## Configuration Checklist

### Backend (.env)
```env
# GitHub OAuth (for user login)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# GitHub App (for repository access)
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Server
PORT=5000
FRONTEND_URL=http://localhost:5174
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000
VITE_USE_MOCK_DATA=false
```

## API Endpoints

### Authentication
- `GET /auth/github` - Get OAuth URL
- `GET /auth/callback?code=...` - Handle OAuth callback
- `GET /auth/user` - Get current user
- `POST /auth/logout` - Logout

### GitHub Integration
- `GET /github/repos` - List all available repositories
- `GET /github/connected-repos` - List connected repositories
- `POST /github/connect` - Connect a repository
  - Body: `{ repo_full_name, repo_id, installation_id }`
  - Returns: `{ success, repo_id, message }`
- `POST /github/disconnect` - Disconnect a repository

### Repository Management
- `GET /api/repos` - List user's connected repos
- `GET /api/repos/:id` - Get repo details
- `GET /api/repos/:id/stats` - Get repo statistics
- `GET /api/repos/:id/commits` - Get commit history
- `GET /api/repos/:id/reviews` - Get reviews for repo

## Database Schema

### Users Table
- `id` (UUID) - Primary key
- `github_id` (Integer) - GitHub user ID
- `username` (String) - GitHub username
- `email`, `avatar_url` - User info

### Repositories Table
- `id` (UUID) - Primary key
- `full_name` (String) - "owner/repo"
- `github_repo_id` (Integer) - GitHub repo ID
- `installation_id` (Integer) - GitHub App installation ID
- `connected_by` (UUID) - Foreign key to users.id
- `status` (String) - 'active', 'paused', etc.

## Connection Verification

### 1. Check User Authentication
```bash
curl http://localhost:5000/auth/user \
  -H "Cookie: session=..." \
  --cookie-jar cookies.txt
```

### 2. Check Available Repos
```bash
curl http://localhost:5000/github/repos \
  -H "Cookie: session=..." \
  --cookie cookies.txt
```

### 3. Connect a Repository
```bash
curl -X POST http://localhost:5000/github/connect \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  --cookie cookies.txt \
  -d '{
    "repo_full_name": "owner/repo",
    "repo_id": 123456,
    "installation_id": 789012
  }'
```

### 4. Check Connected Repos
```bash
curl http://localhost:5000/github/connected-repos \
  -H "Cookie: session=..." \
  --cookie cookies.txt
```

## Troubleshooting

### Issue: "User not found in DB"
- **Cause**: User wasn't created during OAuth callback
- **Fix**: Check `/auth/callback` endpoint logs, ensure user is saved to DB

### Issue: "Failed to get GitHub access token"
- **Cause**: GitHub App not configured or installation_id missing
- **Fix**: 
  1. Verify `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY_PATH` in backend .env
  2. Ensure repository has GitHub App installed
  3. Check `installation_id` is saved when connecting repo

### Issue: "Repository not found"
- **Cause**: Repository not in database or wrong `connected_by` user
- **Fix**: Check `Repository.query.filter_by(connected_by=user_db.id)` returns repos

### Issue: Frontend can't connect to backend
- **Cause**: Wrong `VITE_API_URL` or CORS issues
- **Fix**: 
  1. Set `VITE_API_URL=http://localhost:5000` in frontend .env
  2. Check backend CORS settings in `app.py`
  3. Ensure backend is running on port 5000

## Testing the Connection

1. **Start Backend**: `cd backend && python app.py`
2. **Start Frontend**: `cd frontend && npm run dev`
3. **Sign In**: Click "Sign in with GitHub" → complete OAuth
4. **Connect Repo**: Click "Connect" on a repository
5. **Verify**: Check repository appears in dashboard and `/api/repos/:id` works

## Next Steps After Connection

- Repository should trigger initial scan automatically
- Webhook events should be received for PR/push events
- Commits history should load (if GitHub App configured)
- Reviews should appear in the dashboard
