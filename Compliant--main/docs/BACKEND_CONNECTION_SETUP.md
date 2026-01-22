# Backend Connection Setup Guide

## 🚨 Important: "Backend is Mocked" Fix

If your developer is seeing the message **"the backend is mocked"**, it means the frontend application is running in **mock mode** because the backend API is not configured.

### What This Means

When the `VITE_API_BASE_URL` environment variable is not set, the frontend will:
- ✅ Run successfully
- ❌ NOT save any data to the backend
- ❌ Show warnings in the browser console: `⚠️ MOCK MODE: Backend not configured. Data will not persist.`
- ❌ Return empty/mock data for all API operations

### Quick Fix for Local Development

The `.env` file has been created with the proper configuration to connect to the backend at `http://localhost:3001`.

**To start using the backend:**

1. **Start the backend server:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   
   You should see:
   ```
   ✅ Server running on http://localhost:3001
   ```

2. **Start the frontend:**
   ```bash
   # In the root directory
   npm install
   npm run dev
   ```
   
   You should see:
   ```
   ✅ Backend URL configured: http://localhost:3001
   ```

3. **Verify the connection:**
   - Open the browser console (F12)
   - You should NOT see any "MOCK MODE" warnings
   - All data operations will now persist to the backend

### Environment Files Created

Two `.env` files have been created for you:

1. **Frontend `.env`** (root directory)
   - Contains: `VITE_API_BASE_URL=http://localhost:3001`
   - Tells the frontend where to find the backend API

2. **Backend `.env`** (backend directory)
   - Contains: JWT secret, frontend URL, SMTP configuration (commented out)
   - Configures the backend server settings

### How to Verify It's Working

1. **Check browser console** - No "MOCK MODE" warnings
2. **Create a contractor** - Data should persist after page refresh
3. **Check backend logs** - Should show incoming API requests
4. **Network tab** (F12) - Should show successful requests to `http://localhost:3001`

### Troubleshooting

**Still seeing "Backend not configured"?**
- Ensure backend is running on port 3001
- Check that `.env` file exists in root directory
- Restart the frontend development server
- Clear browser cache and hard reload

**Backend not starting?**
- Check if port 3001 is already in use
- Verify backend dependencies are installed: `cd backend && npm install`
- Check backend logs for errors

**CORS errors?**
- Verify `FRONTEND_URL` in backend/.env matches your frontend URL
- Default is `http://localhost:5175` (Vite's default port)

### Production Deployment

For production deployments to Vercel, Render, or Netlify:
- Set `VITE_API_BASE_URL` as an environment variable in your hosting platform
- Point it to your deployed backend URL
- See [docs/PRODUCTION_DEPLOYMENT_FIX.md](./PRODUCTION_DEPLOYMENT_FIX.md) for detailed instructions

### Additional Resources

- 📘 [QUICKSTART.md](./QUICKSTART.md) - Complete setup guide
- 📘 [DEPLOY.md](./DEPLOY.md) - Production deployment instructions
- 📘 [PRODUCTION_DEPLOYMENT_FIX.md](./PRODUCTION_DEPLOYMENT_FIX.md) - Fix deployment issues
- 📘 [EMAIL_SETUP.md](./EMAIL_SETUP.md) - Configure email notifications

## Default Login Credentials

- **Username:** `admin`
- **Password:** `INsure2026!`
