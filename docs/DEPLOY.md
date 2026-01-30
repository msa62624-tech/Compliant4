# Complete Deployment Guide: INsuretrack Frontend + Backend

## 🚨 IMPORTANT: Fix "Backend not configured" Error

**If you're experiencing "Backend not configured. Cannot save data" in production:**

The `.env` file in your repository is git-ignored and does NOT get deployed. You must configure environment variables in your hosting platform's dashboard.

**Quick Fix:**
1. Go to your deployment platform (Vercel/Render/Netlify)
2. Add environment variable: `VITE_API_BASE_URL` = `https://your-backend-url.com`
3. Redeploy your frontend

👉 **[Complete Fix Guide: PRODUCTION_DEPLOYMENT_FIX.md](./PRODUCTION_DEPLOYMENT_FIX.md)**

---

This guide walks you through deploying both the frontend and backend of INsuretrack.

## Architecture

```
┌─────────────────┐         ┌──────────────────────────┐
│  Vercel/Netlify │         │  Render/Vercel/Railway   │
│  (Frontend)     │────────▶│  (Backend API)           │
│  React + Vite   │  HTTPS  │  FastAPI (Python) OR     │
└─────────────────┘         │  Express.js (Node.js)    │
                            └──────────────────────────┘
```

## Step 1: Deploy Backend API

**Choose one backend option:**

### Option A: Deploy Python Backend to Render (Recommended)

1. **Create Render Account** (if needed)
   - Go to https://render.com/
   - Sign up or log in

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository: `msa62624-tech/Compliant4`
   - Configure:
     - Name: `compliant-backend-python`
     - Root Directory: `backend-python`
     - Environment: `Python 3`
     - Build Command: `pip install -r requirements.txt`
     - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

3. **Set Environment Variables** in Render Dashboard
   - In your web service, go to "Environment" tab
   - Add:
     - `JWT_SECRET` = (generate a secure random string)
     - `FRONTEND_URL` = `https://your-frontend.vercel.app`
     - `ENV` = `production`
     - `DATABASE_URL` = (optional - Render can provision PostgreSQL)
   
   **Email Configuration (Required for notifications):**
   Choose one option:
   
   **Option A: Gmail** (Quick setup, good for testing)
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` = `your.email@gmail.com`
   - `SMTP_PASS` = `your-16-char-app-password`
   - `SMTP_FROM` = `your.email@gmail.com`
   
   **Option B: SendGrid** (Recommended for production)
   - `SMTP_HOST` = `smtp.sendgrid.net`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` = `apikey`
   - `SMTP_PASS` = `your-sendgrid-api-key`
   - `SMTP_FROM` = `verified@yourdomain.com`
   
   See [EMAIL_SETUP.md](EMAIL_SETUP.md) for detailed email configuration instructions.

4. **Deploy** - Render will automatically deploy your backend

5. **Copy the backend URL** (e.g., `https://compliant-backend-python.onrender.com`)

### Option B: Deploy Node.js Backend to Vercel (Legacy)

1. **Install Vercel CLI** (if needed)
   ```bash
   npm i -g vercel
   ```

2. **Deploy Backend**
   ```bash
   cd backend
   vercel --prod
   ```
   
   Follow prompts:
   - Set up and deploy? **Y**
   - Which scope? (select your account)
   - Link to existing project? **N**
   - Project name: `compliant-backend`
   - Directory: **./backend** (or just hit enter)
   - Override settings? **N**

3. **Set Environment Variables** in Vercel Dashboard
   - Go to https://vercel.com/
   - Select your backend project
   - Settings → Environment Variables
   - Add:
     - `JWT_SECRET` = (generate a secure random string)
     - `FRONTEND_URL` = `https://insuretrack1234.vercel.app`
     - `NODE_ENV` = `production`
   
   **Email Configuration (Required for notifications):**
   Choose one option:
   
   **Option A: Gmail** (Quick setup, good for testing)
   - `SMTP_SERVICE` = `gmail`
   - `SMTP_USER` = `your.email@gmail.com`
   - `SMTP_PASS` = `your-16-char-app-password`
   - `SMTP_FROM` = `your.email@gmail.com`
   - `SMTP_REQUIRE_TLS` = `true`
   
   **Option B: SendGrid** (Recommended for production)
   - `SMTP_HOST` = `smtp.sendgrid.net`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` = `apikey`
   - `SMTP_PASS` = `your-sendgrid-api-key`
   - `SMTP_FROM` = `verified@yourdomain.com`
   - `SMTP_REQUIRE_TLS` = `true`
   
   See [EMAIL_SETUP.md](EMAIL_SETUP.md) for detailed email configuration instructions.

4. **Redeploy** to apply env vars
   ```bash
   vercel --prod
   ```

5. **Copy the backend URL** (e.g., `https://compliant-backend.vercel.app`)

## Step 2: Deploy & Configure Frontend

### Deploy Frontend to Vercel

1. **Deploy Frontend** (if not already deployed)
   ```bash
   vercel --prod
   ```
   
   OR connect via Vercel Dashboard:
   - Go to https://vercel.com/
   - New Project → Import Git Repository
   - Select `miriamsabel1-lang/INsuretrack1234`
   - Framework Preset: **Vite**
   - Root Directory: **./** (leave as root)
   - Deploy

2. **Add Backend URL to Frontend**
   - Go to your frontend project in Vercel Dashboard
   - Settings → Environment Variables
   - Add:
     - Name: `VITE_API_BASE_URL`
     - Value: Your backend URL (e.g., `https://compliant-backend.vercel.app`)
     - Environment: Select Production, Preview, and Development
   - Click "Save"
   
   **Important:** Do NOT use the `@` prefix or reference secrets in `vercel.json`. For Vercel Hobby tier, environment variables should be set directly in the dashboard.

3. **Redeploy Frontend**
   ```bash
   vercel --prod
   ```
   
   OR use dashboard:
   - Deployments tab → Redeploy latest

## Step 3: Test End-to-End

1. **Open Frontend**
   - Visit: https://insuretrack1234.vercel.app/

2. **Check Configuration**
   - You should see login page
   - Notice should say backend is configured (or show your backend URL)

3. **Login**
   - Username: `demo`
   - Password: `demo`
   - OR use `admin` / `INsure2026!`

4. **Verify API Calls**
   - Open DevTools → Network tab
   - After login, you should see requests to your backend URL
   - Check for successful responses (status 200)

## Environment Variables Reference

### Frontend (Vercel)
```bash
VITE_API_BASE_URL=https://compliant-backend.vercel.app
```

### Backend (Vercel)
```bash
NODE_ENV=production
JWT_SECRET=your-secure-random-string-here
FRONTEND_URL=https://insuretrack1234.vercel.app
```

## CORS Setup

The backend is pre-configured to allow requests from:
- `FRONTEND_URL` environment variable
- Or `*` (all origins) if not set

**Production best practice:** Always set `FRONTEND_URL` to your specific Vercel domain.

## Default Users

| Username | Password    | Role  |
|----------|-------------|-------|
| admin    | INsure2026! | admin |

## Troubleshooting

### "Failed to fetch" errors on Vercel
If you see "failed to fetch" or network errors when the app is deployed to Vercel:

**Root Cause:** The frontend is trying to connect to an invalid or missing backend URL.

**Solution:**
1. **Set VITE_API_BASE_URL** in Vercel Dashboard:
   - Go to your frontend project in Vercel Dashboard
   - Settings → Environment Variables
   - Add `VITE_API_BASE_URL` with your backend URL (e.g., `https://your-backend.vercel.app`)
   - Select all environments (Production, Preview, Development)
   - Click "Save"

2. **Redeploy your frontend:**
   ```bash
   vercel --prod
   ```
   OR use the Vercel Dashboard → Deployments → Redeploy

3. **Verify the configuration:**
   - After redeploying, visit your frontend
   - The login page should NOT show a "Backend API not configured" warning
   - If you still see the warning, clear your browser cache and refresh

**Important:** If `VITE_API_BASE_URL` is not set, the app will run in demo mode with local data only. This is fine for testing, but you need to set the environment variable to connect to a real backend.

**Note about builds:** The `build.js` script automatically creates a `.env` file from `.env.example` if one doesn't exist. This ensures that builds have a default backend URL configured (http://localhost:3001). For production deployments, override this by setting `VITE_API_BASE_URL` in your deployment platform's environment variables (Vercel Dashboard, Render environment, etc.).

### Environment Variable "VITE_API_BASE_URL" references Secret error
If you see an error like: `Environment Variable "VITE_API_BASE_URL" references Secret "vite_api_base_url", which does not exist`

**Solution:**
1. Environment variables should be set in the Vercel Dashboard, not as secrets in `vercel.json`
2. The `vercel.json` file has been updated to remove secret references
3. Set environment variables through Vercel Dashboard:
   - Go to your project in Vercel Dashboard
   - Settings → Environment Variables
   - Add `VITE_API_BASE_URL` with your backend URL as the value
   - Select which environments (Production, Preview, Development)
   - Click "Save"
4. Redeploy your application after adding the environment variable

**Note for Vercel Hobby users:** The `@` prefix in `vercel.json` is for Vercel Secrets, which require CLI setup. For hobby tier, it's simpler to set environment variables directly in the dashboard.

### Frontend shows "Missing configuration"
- ✅ Set `VITE_API_BASE_URL` in Vercel Dashboard (not as a secret)
- ✅ Redeploy frontend after setting env var
- ✅ Refresh the page

### Login fails / Network errors
- Check browser console for CORS errors
- Verify `FRONTEND_URL` is set correctly on backend
- Ensure backend is running and accessible
- Test backend health: `curl https://your-backend.com/health`

### Backend won't start on Vercel
- Check Vercel deployment logs for errors
- Verify `vercel.json` is present in `backend/` folder
- Ensure environment variables are set
- Check that build succeeded

### API calls timeout
- Check backend URL is correct (no trailing slash)
- Verify backend service is not sleeping (Render free tier)
- Check Network tab for actual request URL

## Quick Health Checks

**Backend health:**
```bash
curl https://your-backend.vercel.app/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Backend login test:**
```bash
curl -X POST https://your-backend.vercel.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"INsure2026!"}'
# Should return: {"accessToken":"...","user":{...}}
```

## Production Enhancements

- [ ] Replace in-memory storage with PostgreSQL/MongoDB
- [ ] Add real file upload to S3/Cloudinary
- [x] Configure email service (SMTP) - See [EMAIL_SETUP.md](EMAIL_SETUP.md)
- [ ] Add LLM integration (OpenAI/Anthropic)
- [ ] Configure Adobe Sign with real credentials
- [ ] Add rate limiting
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Configure custom domains

## Support

Backend API documentation: See `backend/README.md`
Frontend setup: See `DEPLOY_RENDER.md`
