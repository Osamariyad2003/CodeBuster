# GitHub App Setup Guide for CodeBuster

This guide will help you configure GitHub App authentication for CodeBuster to enable automated code reviews on your repositories.

## Step 1: Create a GitHub App

1. Go to [GitHub Settings > Developer settings > GitHub Apps](https://github.com/settings/apps)
2. Click **"New GitHub App"**
3. Fill in the following details:

### Basic Information
- **GitHub App name**: CodeBuster (or your preferred name)
- **Homepage URL**: `http://localhost:5174` (or your deployment URL)
- **Callback URL**: `http://localhost:5000/auth/github/callback`
- **Webhook URL**: `http://localhost:5000/webhook/github`
- **Webhook secret**: Generate a secure random string (save this for later)

### Permissions
Set the following **Repository permissions**:
- **Contents**: **Read & Write** (read code files AND push fix branches / commits from the `Run Fix` action)
- **Pull requests**: Read & Write (to comment on PRs and open fix PRs)
- **Issues**: Read & Write (for posting review summaries)
- **Metadata**: Read (required automatically)

> Note: if an installation predates enabling `Contents: Read & write`, the repo
> owner must re-accept the updated permissions via
> *Settings → Applications → CodeBuster → Configure → Review and accept*
> before `Run Fix` will succeed.

### Events
Subscribe to these webhook events:
- ✅ **Pull request** (for PR reviews)
- ✅ **Push** (for commit reviews)

### Where can this GitHub App be installed?
- Choose **"Any account"** for public use, or **"Only on this account"** for private use

4. Click **"Create GitHub App"**

## Step 2: Generate and Download Private Key

1. After creating the app, scroll down to **"Private keys"** section
2. Click **"Generate a private key"**
3. A `.pem` file will be downloaded - **keep this secure!**
4. You can verify the key fingerprint matches: `SHA256:ZZTlCLrOKVL5JrravL7UKRlffbCipz/FlEM+kLVbtog=`

## Step 3: Note Your App ID

- At the top of your GitHub App settings page, you'll see **"App ID: 123456"**
- Copy this number - you'll need it for configuration

## Step 4: Install the App on Your Repository

1. Go to your GitHub App settings page
2. Click **"Install App"** in the left sidebar
3. Choose which organization/account to install it on
4. Select **"All repositories"** or choose specific repositories
5. Click **"Install"**

## Step 5: Configure CodeBuster Backend

1. Navigate to the `backend` directory of your CodeBuster project

2. Copy the configuration template:
   ```bash
   cp config_template.env .env
   ```

3. Open `.env` file and fill in your credentials:

   ```env
   # Flask Configuration
   FLASK_SECRET_KEY=your-random-secret-key-here
   
   # GitHub OAuth Configuration (optional - for user login)
   GITHUB_CLIENT_ID=your-oauth-client-id
   GITHUB_CLIENT_SECRET=your-oauth-client-secret
   
   # GitHub App Configuration (REQUIRED)
   GITHUB_APP_ID=123456
   GITHUB_APP_PRIVATE_KEY="""-----BEGIN RSA PRIVATE KEY-----
   MIIEpAIBAAKCAQEA...
   [paste your entire private key content here]
   ...
   -----END RSA PRIVATE KEY-----"""
   
   # GitHub Webhook Secret
   GITHUB_WEBHOOK_SECRET=your-webhook-secret-from-step-1
   
   # Frontend URL
   FRONTEND_URL=http://localhost:5174
   ```

4. **Important Notes:**
   - The private key must include the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` lines
   - Use triple quotes `"""` to include multi-line private key
   - Never commit the `.env` file to version control!

## Step 6: Test the Setup

1. Start the backend server:
   ```bash
   cd backend
   python app.py
   ```

2. The server should start without errors. Look for:
   ```
   * Running on http://127.0.0.1:5000
   ```

3. Test the webhook endpoint:
   ```bash
   curl http://localhost:5000/health
   ```

   You should see:
   ```json
   {
     "status": "healthy",
     "service": "CodeBuster API",
     "version": "1.0.0"
   }
   ```

## Step 7: Test with a Pull Request

1. Create a test PR in one of your connected repositories
2. Check the backend logs - you should see:
   ```
   [CodeBuster] Posting review to username/repo#123
   ```

3. Check the PR on GitHub - CodeBuster should post:
   - A summary comment with quality score
   - Inline comments on specific lines of code

## Troubleshooting

### "Failed to get installation token"
- Verify your `GITHUB_APP_ID` is correct
- Check that your private key is properly formatted
- Ensure the app is installed on the repository

### "No installation found for repo"
- Make sure you've installed the GitHub App on the repository
- Check that the app has the correct permissions

### Webhook not receiving events
- Verify the webhook URL is accessible (use ngrok for local development)
- Check the webhook secret matches
- Look at webhook delivery logs in GitHub App settings

### JWT/Token errors
- Ensure `PyJWT` and `cryptography` are installed:
  ```bash
  pip install -r requirements.txt
  ```

## Local Development with Webhooks

For local development, GitHub webhooks can't reach `localhost`. Use one of these solutions:

### Option 1: ngrok (Recommended)
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 5000

# Update your GitHub App webhook URL to the ngrok URL:
# https://abc123.ngrok.io/webhook/github
```

### Option 2: GitHub CLI Tunnel
```bash
gh codespace ports forward 5000:5000
```

### Option 3: Manual Testing
Use the manual upload feature in CodeBuster frontend to test reviews without webhooks.

## Security Best Practices

1. ✅ Never commit `.env` file or private keys to version control
2. ✅ Use strong, random secrets for `FLASK_SECRET_KEY` and `GITHUB_WEBHOOK_SECRET`
3. ✅ Rotate your private key periodically
4. ✅ Use environment-specific configurations (dev, staging, production)
5. ✅ Enable webhook signature verification (already implemented)
6. ✅ Use HTTPS in production (required by GitHub for webhooks)

## Production Deployment

For production:
1. Use a proper secrets management system (AWS Secrets Manager, HashiCorp Vault, etc.)
2. Enable HTTPS with valid SSL certificates
3. Set up proper CORS policies
4. Use a production-grade database instead of in-memory storage
5. Monitor webhook delivery and API rate limits
6. Set up logging and error tracking (Sentry, DataDog, etc.)

---

**Your GitHub App is now fully configured!** 🎉

The private key fingerprint you provided: `SHA256:ZZTlCLrOKVL5JrravL7UKRlffbCipz/FlEM+kLVbtog=` can be used to verify you're using the correct key.

