# Production Deployment Fix: "Backend not configured" Error

## Problem

When using the deployed/published application, you receive this error:
```
Failed to create contractor: Backend not configured. Cannot save data. 
Please configure VITE_API_BASE_URL in .env file.
```

## Root Cause

The application is deployed to a hosting platform (Vercel, Render, or Netlify) but the **environment variable** `VITE_API_BASE_URL` is not configured in the deployment platform settings.

**Important:** The `.env` file in your local repository is **git-ignored** and does NOT get deployed. You must configure environment variables directly in your hosting platform's dashboard.

## Solution by Platform

### If You're Using Vercel

1. **Go to Vercel Dashboard**: https://vercel.com/
2. **Select Your Project** (e.g., `insuretrack1234`)
3. **Go to Settings** → **Environment Variables**
4. **Add New Variable:**
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** Your backend API URL (see options below)
   - **Environment:** Select all (Production, Preview, Development)
5. **Click "Save"**
6. **Redeploy:**
   - Go to **Deployments** tab
   - Click on the latest deployment
   - Click **"Redeploy"** button

### If You're Using Render

1. **Go to Render Dashboard**: https://render.com/
2. **Select Your Static Site** (frontend project)
3. **Go to Environment** tab
4. **Add Environment Variable:**
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** Your backend API URL (see options below)
5. **Click "Save Changes"**
6. Render will automatically redeploy

### If You're Using Netlify

1. **Go to Netlify Dashboard**: https://netlify.com/
2. **Select Your Site**
3. **Go to Site Settings** → **Environment Variables**
4. **Add Variable:**
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** Your backend API URL (see options below)
5. **Click "Save"**
6. **Trigger Redeploy:**
   - Go to **Deploys** tab
   - Click **"Trigger deploy"** → **"Deploy site"**

## Backend API URL Options

### Option 1: Use Deployed Backend (Recommended for Production)

If you have deployed the backend to Vercel/Render:

```
VITE_API_BASE_URL=https://your-backend-name.vercel.app
```
OR
```
VITE_API_BASE_URL=https://your-backend-name.onrender.com
```

**How to deploy the backend:**
- See [DEPLOY.md](./DEPLOY.md) for complete backend deployment instructions
- Backend must be deployed separately from frontend
- Backend needs its own environment variables (JWT_SECRET, SMTP config, etc.)

### Option 2: Use Local Backend (For Testing Only)

```
VITE_API_BASE_URL=http://localhost:3001
```

**Note:** This only works when testing locally. Production deployments need a real backend URL.

## How to Deploy Your Backend

If you haven't deployed the backend yet, follow these steps:

### Deploy Backend to Render (Recommended)

1. **Create Web Service:**
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repo: `miriamsabel1-lang/INsuretrack1234`
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

2. **Add Environment Variables:**
   ```
   NODE_ENV=production
   JWT_SECRET=your-secure-random-string-here
   FRONTEND_URL=https://your-frontend-url.com
   SMTP_HOST=smtp.office365.com
   SMTP_PORT=587
   SMTP_USER=your-email@yourdomain.com
   SMTP_PASS=your-password
   SMTP_FROM=your-email@yourdomain.com
   SMTP_SECURE=false
   SMTP_REQUIRE_TLS=true
   ```

3. **Deploy** and copy the backend URL (e.g., `https://compliant-backend.onrender.com`)

4. **Use this URL** in your frontend's `VITE_API_BASE_URL`

### Deploy Backend to Vercel

1. **Navigate to backend:**
   ```bash
   cd backend
   vercel --prod
   ```

2. **Add environment variables** in Vercel Dashboard (same as above)

3. **Copy the backend URL** and use it in frontend's `VITE_API_BASE_URL`

## Verification

After configuring and redeploying:

1. **Visit your deployed frontend URL**
2. **Check the browser console** (F12 → Console tab)
3. **You should see:**
   ```
   ✅ Backend URL configured: https://your-backend-url.com
   ```
   
4. **If you still see:**
   ```
   ❌ CRITICAL: Backend URL not configured!
   ```
   Then the environment variable wasn't set correctly. Double-check:
   - Variable name is exactly: `VITE_API_BASE_URL`
   - Variable is set for Production environment
   - You redeployed after adding the variable

## Login Credentials

The correct login credentials are:
- **Username:** `admin`
- **Password:** `INsure2026!`

*(Not the old demo password `admin123` that was previously documented)*

## Additional Troubleshooting

### Error: "Cannot connect to backend"

**Check:**
1. Is your backend deployed and running?
2. Visit your backend URL directly (e.g., `https://your-backend.vercel.app/health`)
3. You should see: `{"status":"ok","timestamp":"..."}`
4. If backend health check fails, check backend deployment logs

### Error: "CORS policy" in console

**Fix:**
1. Set `FRONTEND_URL` environment variable in your **backend** deployment
2. Value should be your frontend URL (e.g., `https://insuretrack1234.vercel.app`)
3. Redeploy backend

### Error: Login works but data doesn't save

**Check:**
1. Verify `VITE_API_BASE_URL` is correctly set in frontend
2. Check browser Network tab (F12) - look for API requests
3. Ensure requests are going to your backend URL (not localhost)
4. Check backend logs for errors

## Quick Reference: Environment Variables

### Frontend (Vercel/Render/Netlify)
```bash
VITE_API_BASE_URL=https://your-backend-url.com
```

### Backend (Vercel/Render)
```bash
NODE_ENV=production
JWT_SECRET=your-secure-random-string
FRONTEND_URL=https://your-frontend-url.com
# Plus SMTP configuration - see DEPLOY.md
```

## Need More Help?

- Backend deployment: See [DEPLOY.md](./DEPLOY.md)
- Email setup: See [EMAIL_SETUP.md](./EMAIL_SETUP.md)
- Local development: See [README.md](./README.md)
- Architecture: See [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)
