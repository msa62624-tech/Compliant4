# Backend API Configuration Guide

This guide will help you configure the backend API connection and email (SMTP) for INsuretrack.

## Quick Setup

### Frontend Setup

```bash
# Copy the example environment file
cp .env.example .env
# Edit .env to set VITE_API_BASE_URL to your backend URL
# Default for local development: http://localhost:3001
npm run dev
```

### Backend Setup

```bash
cd backend
# Copy the example environment file
cp .env.example .env
# Edit backend/.env to configure SMTP email settings (see below)
npm run dev
```

**Optional:** Run `npm run setup` from the project root for an interactive configuration wizard.

## Manual Setup

### Frontend Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and set your backend URL:
   ```bash
   VITE_API_BASE_URL=http://localhost:3001
   ```
   
   Or for a remote backend:
   ```bash
   VITE_API_BASE_URL=https://your-backend-url.com
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

1. Navigate to the backend directory and copy the example file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `backend/.env` and configure:

   **Required settings:**
   ```bash
   PORT=3001
   JWT_SECRET=your-secret-key-change-in-production
   FRONTEND_URL=http://localhost:5173
   ```

   **Email configuration (choose one):**
   
   Option A - Microsoft 365 / Outlook (recommended):
   ```bash
   SMTP_HOST=smtp.office365.com
   SMTP_PORT=587
   SMTP_USER=your.email@yourdomain.onmicrosoft.com
   SMTP_PASS=your-password
   SMTP_FROM=your.email@yourdomain.onmicrosoft.com
   SMTP_SECURE=false
   SMTP_REQUIRE_TLS=true
   SMTP_TLS_REJECT_UNAUTHORIZED=true
   ```
   
   Option B - Gmail:
   ```bash
   SMTP_SERVICE=gmail
   SMTP_USER=your.email@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_FROM=your.email@gmail.com
   SMTP_REQUIRE_TLS=true
   ```
   
   Option C - Custom SMTP:
   ```bash
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=SG.xxxxxx
   SMTP_FROM=no-reply@yourdomain.com
   ```

3. Start the backend:
   ```bash
   npm install
   npm run dev
   ```

## Configuration Options

### Option 1: Local Development

For local development with a backend running on your machine:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

Make sure your backend is running on port 3001:
```bash
cd backend
npm run dev
```

### Option 2: Remote Backend

For connecting to a deployed backend:

```bash
VITE_API_BASE_URL=https://your-backend.example.com
```

Examples:
- Vercel: `https://compliant-backend.vercel.app`
- Render: `https://compliant-backend.onrender.com`
- Custom domain: `https://api.insuretrack.com`

### Option 3: Demo Mode

To run without a backend (demo mode with local data):

Simply don't set the `VITE_API_BASE_URL` variable, or comment it out in your `.env` file:

```bash
# VITE_API_BASE_URL=http://localhost:3001
```

In demo mode:
- ✅ You can explore the UI
- ✅ Demo login credentials work (admin/INsure2026!)
- ⚠️ No real data persistence
- ⚠️ Limited functionality

## Deployment Environments

### Vercel

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add a new variable:
   - Name: `VITE_API_BASE_URL`
   - Value: Your backend URL (e.g., `https://your-backend.vercel.app`)
4. Redeploy your application

### Netlify

1. Go to Site settings → Environment variables
2. Add a new variable:
   - Key: `VITE_API_BASE_URL`
   - Value: Your backend URL
3. Trigger a new deployment

### Render

1. Go to your web service settings
2. Navigate to "Environment"
3. Add a new environment variable:
   - Key: `VITE_API_BASE_URL`
   - Value: Your backend URL
4. Render will automatically redeploy

### Other Platforms

For other platforms, add the `VITE_API_BASE_URL` environment variable through their respective configuration interfaces or deployment settings.

## Verification

After setting up your environment:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:5175 in your browser

3. Check the login page:
   - **If configured correctly**: No warning message appears
   - **If in demo mode**: You'll see a yellow warning banner

4. Try logging in:
   - Username: `admin`
   - Password: `INsure2026!`

## Troubleshooting

### Warning still appears after configuration

1. Make sure your `.env` file is in the root directory
2. Ensure the variable name is exactly `VITE_API_BASE_URL`
3. Restart your development server (stop and run `npm run dev` again)
4. Clear your browser cache or try in incognito mode

### Cannot connect to backend

1. Verify the backend URL is correct and accessible
2. Check if the backend server is running
3. Ensure there are no CORS issues (backend must allow requests from your frontend URL)
4. Check browser console for network errors (F12 → Console tab)

### Environment variable not working in production

1. Make sure the environment variable is set in your deployment platform
2. **Important**: Environment variables starting with `VITE_` are embedded at build time
3. You must redeploy (not just restart) after changing environment variables
4. Check your platform's build logs to confirm the variable was available during build

## Additional Resources

- [Vite Environment Variables Documentation](https://vitejs.dev/guide/env-and-mode.html)
- [Backend Setup Guide](./backend/README.md)
- [Deployment Guide](./DEPLOY.md)

## Need Help?

If you're still having trouble:

1. Check the browser console for errors (F12 → Console)
2. Check the network tab for failed requests (F12 → Network)
3. Verify your backend is accessible by visiting its URL directly
4. Review the [Deployment Guide](./DEPLOY.md) for platform-specific instructions
