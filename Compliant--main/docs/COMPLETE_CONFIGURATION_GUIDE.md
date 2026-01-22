# Complete Configuration Guide: Remove ALL Mocking

This guide explains how to configure all services to eliminate mocking from the application.

## ✅ Already Configured (Via .env Files)

### 1. Backend API Connection
- **File:** `.env`
- **Variable:** `VITE_API_BASE_URL=http://localhost:3001`
- **Status:** ✅ CONFIGURED
- **What it does:** Connects frontend to backend server

### 2. Backend Server
- **File:** `backend/.env`
- **Variables:**
  - `PORT=3001`
  - `JWT_SECRET=compliant-dev-secret-change-in-production`
  - `FRONTEND_URL=http://localhost:5175`
- **Status:** ✅ CONFIGURED
- **What it does:** Basic backend server configuration

## ⚠️ Requires Additional Configuration

### 3. Email Service (SMTP)

**Current State:** Backend falls back to mock email when SMTP is not configured

**To Enable Real Emails:**

Edit `backend/.env` and uncomment/configure one of these options:

#### Option A: Microsoft 365 / Outlook (Recommended)
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your.email@yourdomain.com
SMTP_PASS=your-password
SMTP_FROM=your.email@yourdomain.com
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_TLS_REJECT_UNAUTHORIZED=true
```

#### Option B: Gmail (Requires App Password)
```bash
SMTP_SERVICE=gmail
SMTP_USER=your.email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=your.email@gmail.com
SMTP_REQUIRE_TLS=true
```

**How to get Gmail App Password:**
1. Enable 2-Step Verification on your Google Account
2. Go to https://myaccount.google.com/apppasswords
3. Create an App Password for "Mail"
4. Use the 16-character password in SMTP_PASS

#### Option C: Custom SMTP
```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=no-reply@yourdomain.com
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
```

**Verification:**
- Start backend: `cd backend && npm run dev`
- Send a test email through the application
- Check backend console - should see "✅ Email sent successfully" instead of "MOCK EMAIL"

### 4. Adobe PDF Services (Optional - for PDF extraction)

**Current State:** Backend uses mock PDF extraction data

**To Enable Real PDF Services:**

1. **Get Adobe PDF Services credentials:**
   - Sign up at https://developer.adobe.com/document-services/
   - Create a project
   - Get API Key and Client ID

2. **Configure in `backend/.env`:**
```bash
ADOBE_API_KEY=your-adobe-api-key-here
ADOBE_CLIENT_ID=your-adobe-client-id-here
```

**Verification:**
- Start backend
- Upload a PDF for analysis
- Check backend logs for "✅ Adobe PDF Services: ENABLED"

**Alternative:** If you don't configure Adobe, the application will continue using mock PDF extraction which may be sufficient for development.

### 5. AI Analysis Service (Optional - for compliance checking)

**Current State:** Backend uses mock compliance analysis

**To Enable Real AI Analysis:**

#### Option A: OpenAI
```bash
AI_PROVIDER=openai
AI_API_KEY=sk-your-openai-api-key
AI_MODEL=gpt-4-turbo-preview
```

#### Option B: Anthropic Claude
```bash
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-your-anthropic-key
AI_MODEL=claude-3-opus-20240229
```

**How to get API keys:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/

**Verification:**
- Start backend
- Use AI-powered features in the application
- Check backend logs for "✅ AI Analysis Service: ENABLED"

**Alternative:** If you don't configure AI, the application will continue using mock analysis which may be sufficient for development.

## 📋 Configuration Checklist

### Required for Production:
- [x] Backend API URL (`VITE_API_BASE_URL`)
- [x] Backend server config (`PORT`, `JWT_SECRET`, `FRONTEND_URL`)
- [ ] **SMTP Email** - REQUIRED if you want to send emails
- [ ] Change `JWT_SECRET` to a secure random string in production

### Optional (depends on features used):
- [ ] Adobe PDF Services - Only needed if using PDF extraction features
- [ ] AI Analysis - Only needed if using AI-powered compliance checking
- [ ] Admin emails (`ADMIN_EMAILS`) - For notification routing

## 🚀 Quick Start

### Minimal Setup (No External Services):
```bash
# Already configured! Just start the servers:
cd backend && npm run dev
# In another terminal:
npm run dev
```

**What works:**
- ✅ Full CRUD operations
- ✅ Data persistence
- ✅ User authentication
- ✅ File uploads
- ⚠️ Emails (mocked - logged but not sent)
- ⚠️ PDF extraction (mocked - sample data)
- ⚠️ AI analysis (mocked - sample results)

### Full Setup (All Services):
1. Configure SMTP (see above)
2. Configure Adobe PDF Services (optional)
3. Configure AI Service (optional)
4. Start servers

**What works:**
- ✅ Everything above PLUS:
- ✅ Real email delivery
- ✅ Real PDF text extraction
- ✅ Real AI-powered compliance analysis

## 🔍 How to Verify Configuration

### Check Backend Console on Startup:
```
✅ Server running on http://localhost:3001
✅ Backend initialized with sample data

Configuration Status:
✅ Adobe PDF Services: ENABLED      (or ⚠️ DISABLED)
✅ AI Analysis Service: ENABLED     (or ⚠️ DISABLED)
✅ Using real SMTP: smtp.office365.com  (or ⚠️ using mock email)
```

### Check Frontend Console:
```
✅ Backend URL configured: http://localhost:3001
(No "MOCK MODE" warnings should appear)
```

## 📚 Additional Resources

- **Email Setup:** See `docs/EMAIL_SETUP.md` for detailed SMTP configuration
- **Backend Connection:** See `docs/BACKEND_CONNECTION_SETUP.md`
- **Production Deployment:** See `docs/PRODUCTION_DEPLOYMENT_FIX.md`
- **Quick Start:** See `docs/QUICKSTART.md`

## ⚡ Summary

**What's already configured:**
- Backend API connection ✅
- Basic server configuration ✅

**What requires additional setup:**
- Email service (SMTP) - Required for sending emails
- Adobe PDF Services - Optional for PDF features
- AI Analysis - Optional for AI features

**The application will work with just the basic configuration**, but some features will use mock data. Configure additional services as needed for your use case.
