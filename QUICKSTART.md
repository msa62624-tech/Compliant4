# InsureTrack - Quick Start Guide

## All Issues Fixed ✅

1. **Address Input** - Can now type unlimited characters
2. **Token Expiration** - Extended to 24 hours 
3. **Email Configuration** - Microsoft 365 configured
4. **Backend Connection** - Properly configured

## Start Everything (Easy Mode)

### Option 1: Single Command for Python Backend
**Note:** This convenience script currently only supports the Python backend.

**For Python Backend:**
```bash
chmod +x start.sh
./start.sh
```

This starts both backend and frontend automatically!

### Option 2: Manual Start (Two Terminals)

**Option A: Python Backend (Recommended):**

**Terminal 1 - Python Backend:**
```bash
cd backend-python
uvicorn main:app --reload --host 0.0.0.0 --port 3001
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

**Option B: Node.js Backend (Legacy):**

**Terminal 1 - Node.js Backend:**
```bash
cd backend
node server.js
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## What You Should See

### Backend Output:
```
✅ Using JWT_SECRET from environment variable
✅ Backend configured: http://localhost:3001
Server running on http://localhost:3001
```

### Frontend Output:
```
VITE v5.x.x ready in xxx ms
➜ Local: http://localhost:5175/
```

### Browser Console:
```
✅ Backend configured: http://localhost:3001
✅ Token stored in localStorage successfully
```

## Test Everything Works

1. **Open**: http://localhost:5175
2. **Login**: Use your credentials
3. **Add GC**: 
   - Fill in company name
   - Type full address (no character limit!)
   - Click Add - should work without token errors
4. **Check Console**: Should see detailed logs

## Configuration Files Created

- `/workspaces/Compliant4/.env` - Frontend config
- `/workspaces/Compliant4/backend-python/.env` - Python backend config (if using Python)
- `/workspaces/Compliant4/backend/.env` - Node.js backend config (if using Node.js)

## Common Issues

### "Backend not configured" error
- Make sure backend is running on port 3001
- Restart frontend after creating `.env` file

### Token expired error
- Log out and log back in
- Token now lasts 24 hours instead of 1 hour

### Address input stops after 2 characters
- Fixed! You can now type freely

### Can't add GC
- Check both backend and frontend are running
- Check browser console for specific error

## Commit Your Changes

```bash
git add .
git commit -m "Fix all issues: address input, token expiration, backend config, email setup"
git push origin main
```

## Need Help?

Check the logs:
- Backend: `tail -f backend.log` (if using start.sh)
- Frontend: Look at the terminal running `npm run dev`
- Browser: Open Developer Console (F12)
