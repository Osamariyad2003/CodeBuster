# 🚀 Setup Your GitHub App - Complete Guide

Your GitHub App private key fingerprint: `SHA256:ZZTlCLrOKVL5JrravL7UKRlffbCipz/FlEM+kLVbtog=`

## What You Need to Do

### 1️⃣ Create Your `.env` File

In the `backend` folder, create a file named `.env` (note: starts with a dot):

```bash
cd backend
cp config_template.env .env
```

### 2️⃣ Add Your Private Key

Open the `.env` file and paste your GitHub App private key. It should look like this:

```env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="""-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAyourprivatekeycontentgoeshere
anotherlineofyourprivatekey
andanother
...
morelinesofthekey
-----END RSA PRIVATE KEY-----"""
GITHUB_WEBHOOK_SECRET=your-webhook-secret
FLASK_SECRET_KEY=any-random-string
FRONTEND_URL=http://localhost:5174
```

**Important:**
- Keep the triple quotes `"""` around the key
- Include the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` lines
- Don't add extra spaces or newlines

### 3️⃣ Where to Get These Values

| Variable | Where to Find It |
|----------|------------------|
| `GITHUB_APP_ID` | On your GitHub App settings page (top of the page) |
| `GITHUB_APP_PRIVATE_KEY` | Download `.pem` file from GitHub App settings → "Generate private key" |
| `GITHUB_WEBHOOK_SECRET` | You create this yourself (any random string) when setting up the GitHub App |
| `FLASK_SECRET_KEY` | Any random string (for session security) |

### 4️⃣ Verify Your Setup

Run the verification script to check everything is configured correctly:

```bash
cd backend
python verify_setup.py
```

You should see all green checkmarks ✅

### 5️⃣ Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 6️⃣ Test It Out

**Option A: Manual Upload**
1. Open http://localhost:5174 in your browser
2. Go to "Manual Upload" tab
3. Drag & drop a code folder
4. See the AI review results!

**Option B: GitHub PR Review**
1. Install the GitHub App on a repository
2. Create a test Pull Request
3. Wait 30-90 seconds
4. Check your PR - CodeBuster will post review comments!

## 📁 File Structure

Your backend folder should look like this:

```
backend/
├── .env                      ← YOUR SECRETS (never commit!)
├── .gitignore               ← Protects .env from being committed
├── config_template.env      ← Template (safe to commit)
├── app.py                   ← Main Flask application
├── requirements.txt         ← Python dependencies
├── verify_setup.py          ← Setup verification script
├── GITHUB_APP_SETUP.md      ← Detailed setup guide
└── QUICK_START.md           ← Quick reference
```

## 🔒 Security Checklist

- ✅ Your private key is in `.env` (not in code)
- ✅ The `.env` file is listed in `.gitignore`
- ✅ You never commit `.env` to Git
- ✅ You use a strong `FLASK_SECRET_KEY`
- ✅ You use a random `GITHUB_WEBHOOK_SECRET`

## 🐛 Troubleshooting

### "ModuleNotFoundError: No module named 'dotenv'"
```bash
cd backend
pip install -r requirements.txt
```

### ".env file not found"
```bash
cd backend
cp config_template.env .env
# Then edit .env with your credentials
```

### "Invalid private key format"
- Make sure you copied the ENTIRE private key including headers
- Keep the triple quotes around it
- No extra spaces at the beginning of lines

### "Failed to get installation token"
1. Check your `GITHUB_APP_ID` is correct
2. Verify the private key is properly formatted
3. Ensure the GitHub App is installed on the repository

## 📚 Additional Resources

- **Detailed Setup:** `backend/GITHUB_APP_SETUP.md`
- **Quick Reference:** `backend/QUICK_START.md`
- **GitHub Docs:** https://docs.github.com/en/developers/apps

## 🎉 What Happens After Setup

Once configured, CodeBuster will:

1. ✅ Automatically review every new Pull Request
2. ✅ Post a quality score (0-10) as a PR comment
3. ✅ Add inline comments on specific code issues
4. ✅ Categorize issues (Security, Performance, Style, etc.)
5. ✅ Suggest code fixes for detected problems
6. ✅ Track code quality trends in the analytics dashboard

---

**Need help?** Check the troubleshooting section or review the detailed setup guide in `backend/GITHUB_APP_SETUP.md`.

**Ready to go?** Run `python backend/verify_setup.py` to verify your setup! 🚀

