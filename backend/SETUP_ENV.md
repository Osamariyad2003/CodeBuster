# Environment Setup Guide

## .env File Configuration

Create a `.env` file in the `backend/` directory based on `config_template.env`.

### Important Notes:

1. **GitHub Private Key**: Do NOT put the private key directly in the `.env` file as a multi-line string. Instead:
   - Save the private key to a file (e.g., `github-private-key.pem`)
   - Set `GITHUB_APP_PRIVATE_KEY_PATH=path/to/github-private-key.pem` in your `.env`

2. **Required Variables** (minimum for basic functionality):
   ```env
   FLASK_SECRET_KEY=your-secret-key-here
   FRONTEND_URL=http://localhost:5173
   ```

3. **Optional Variables** (for full functionality):
   - `OPENAI_API_KEY` - For AI-powered reviews (falls back to rule-based if not set)
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - For OAuth
   - `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY_PATH` - For GitHub App
   - `GITHUB_WEBHOOK_SECRET` - For webhook verification
   - `GITHUB_ACCESS_TOKEN` - For GitHub API access

### Example .env file:

```env
# Flask
FLASK_SECRET_KEY=change-this-to-a-random-string
PORT=5000
FRONTEND_URL=http://localhost:5174
FRONTEND_PORT=5174

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret

# GitHub App (optional)
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY_PATH=./github-private-key.pem
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_ACCESS_TOKEN=ghp_your-token-here

# OpenAI (optional - falls back to rule-based if not set)
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4-turbo-preview

# Database (optional - defaults to SQLite)
DATABASE_URL=sqlite:///codebuster.db
```

## Running the Application

After setting up your `.env` file:

```bash
cd backend
python app.py
```

The application will:
- Load environment variables
- Initialize the SQLite database
- Start the Flask server on http://127.0.0.1:5000

## Troubleshooting

### "Python-dotenv could not parse statement"
- This happens when you have multi-line strings in `.env`
- Solution: Use file paths instead (e.g., `GITHUB_APP_PRIVATE_KEY_PATH`)

### Database errors
- Make sure the `backend/` directory is writable
- The database file will be created automatically at `backend/codebuster.db`

### Import errors
- Make sure you've installed all dependencies: `pip install -r requirements.txt`
- Make sure you're running from the `backend/` directory

