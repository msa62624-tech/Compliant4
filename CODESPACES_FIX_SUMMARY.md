# Codespaces Frontend/Backend Fix Summary

## Problem Fixed ✅

The application had a critical configuration bug that prevented the backend from working properly in GitHub Codespaces.

### What Was Wrong:
- **Frontend couldn't connect to backend in Codespaces**
- The `start.sh` script was setting `VITE_API_BASE_URL` to the **frontend URL** (port 5175) instead of the **backend URL** (port 3001)
- This caused the frontend to try connecting to `https://{CODESPACE_NAME}-5175.app.github.dev` instead of `https://{CODESPACE_NAME}-3001.app.github.dev`
- Result: Backend appeared unreachable, data wouldn't persist

### What Was Fixed:
Changed 3 lines in `start.sh`:
- **Line 23**: `VITE_API_BASE_URL=${FRONTEND_URL_DEFAULT}` → `VITE_API_BASE_URL=${BACKEND_URL_DEFAULT}`
- **Line 38**: Same fix (Codespaces update path)
- **Line 40**: Same fix (else branch)

## How to Use in Codespaces

### Quick Start (Recommended):
```bash
chmod +x start.sh
./start.sh
```

This will:
1. Automatically detect you're in Codespaces
2. Create `.env` with correct backend URL: `https://{CODESPACE_NAME}-3001.app.github.dev`
3. Create `backend/.env` with correct frontend URL
4. Start both backend and frontend automatically

### Manual Start (Two Terminals):
**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm install
npm run dev
```

### What You Should See:

**Backend Console:**
```
✅ Backend configured: https://your-codespace-3001.app.github.dev
compliant.team Backend running on http://localhost:3001
Environment: development
CORS allowed: https://your-codespace-5175.app.github.dev
```

**Frontend Console (Browser F12):**
```
✅ Backend configured: https://your-codespace-3001.app.github.dev
```

## Verification

### ✅ Correct Configuration:
- Frontend `.env` should have: `VITE_API_BASE_URL=https://{CODESPACE_NAME}-3001.app.github.dev`
- Backend `.env` should have: `FRONTEND_URL=https://{CODESPACE_NAME}-5175.app.github.dev`
- No "Backend not configured" errors in browser console
- Data persists after page refresh

### ❌ Incorrect Configuration (Before Fix):
- Frontend `.env` had: `VITE_API_BASE_URL=https://{CODESPACE_NAME}-5175.app.github.dev` ← WRONG PORT!
- "Backend not configured" errors
- Mock mode warnings
- Data doesn't persist

## Technical Details

### URL Format in Codespaces:
- **Frontend**: `https://{CODESPACE_NAME}-5175.app.github.dev` (port 5175)
- **Backend**: `https://{CODESPACE_NAME}-3001.app.github.dev` (port 3001)

### URL Format in Localhost:
- **Frontend**: `http://localhost:5175`
- **Backend**: `http://localhost:3001`

### How start.sh Works:
1. Detects if running in Codespaces by checking `CODESPACE_NAME` env var
2. Constructs URLs based on Codespace name or uses localhost
3. Creates/updates `.env` files with correct URLs
4. Starts backend in background
5. Starts frontend in foreground

## Troubleshooting

### "Backend not configured" error:
1. Stop any running processes
2. Delete `.env` and `backend/.env`
3. Run `./start.sh` again
4. Check that backend starts on port 3001

### Backend won't start:
1. Check if port 3001 is in use: `lsof -i :3001`
2. Kill any process using port 3001
3. Try starting manually: `cd backend && npm run dev`
4. Check backend logs for specific errors

### CORS errors:
- This should not happen after the fix
- CORS configuration already allows all `*.app.github.dev` origins
- If you see CORS errors, verify backend `.env` has correct `FRONTEND_URL`

## For Production/Deployment

This fix only affects the startup script. For production:
- Set `VITE_API_BASE_URL` environment variable in your hosting platform (Vercel/Render/Netlify)
- Point it to your deployed backend URL
- Example: `VITE_API_BASE_URL=https://api.compliant.team`

See [docs/DEPLOY.md](docs/DEPLOY.md) for complete deployment instructions.

## Files Changed
- `start.sh` - Fixed VITE_API_BASE_URL configuration (3 lines)

## Security Note
No security vulnerabilities introduced. The change only corrects URL configuration logic.
