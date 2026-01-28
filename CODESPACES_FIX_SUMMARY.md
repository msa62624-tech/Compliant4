# Codespaces Setup & Fixes

## ✅ All Fixes Applied

### 1. Frontend/Backend Connection Fix
**Fixed**: The `start.sh` script now correctly sets `VITE_API_BASE_URL` to the backend URL (port 3001) instead of the frontend URL (port 5175).

### 2. Automatic Dependency Installation (NEW)
**Fixed**: Added `.devcontainer/devcontainer.json` that automatically installs all dependencies when you open the repository in Codespaces.

## Quick Start in Codespaces

### First Time Setup (Automatic)
1. Open repository in GitHub Codespaces
2. Wait for automatic dependency installation (~30 seconds)
3. You'll see: `Running postCreateCommand...`
4. Once complete, you're ready to start!

### Starting the Application
```bash
./start.sh
```

This will:
- Detect Codespaces environment
- Create `.env` files with correct URLs
- Start backend on port 3001
- Start frontend on port 5175

## What Was Fixed

### Problem 1: Backend Wouldn't Start
**Symptom**: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'express'`

**Cause**: Dependencies weren't installed automatically

**Fix**: Added `postCreateCommand` in `.devcontainer/devcontainer.json`:
```json
"postCreateCommand": "npm install && cd backend && npm install"
```

### Problem 2: Silent Installation Errors
**Symptom**: `start.sh` would fail without showing why

**Cause**: npm install errors were silenced with `> /dev/null 2>&1`

**Fix**: Enhanced error handling in `start.sh`:
- Shows npm install output if it fails
- Displays backend.log tail if backend won't start
- Clear error messages for debugging

### Problem 3: Wrong Backend URL (Previously Fixed)
**Symptom**: "Backend not configured" errors

**Cause**: Frontend was trying to connect to port 5175 instead of 3001

**Fix**: `start.sh` now correctly sets `VITE_API_BASE_URL=${BACKEND_URL_DEFAULT}`

## Configuration Details

### Devcontainer Features
Located in `.devcontainer/devcontainer.json`:
- **Base Image**: Node.js 20
- **Auto-Install**: Dependencies for frontend and backend
- **Port Forwarding**: Ports 5175 and 3001
- **VS Code Extensions**: ESLint, Prettier, Tailwind CSS
- **Settings**: Format on save enabled

### URL Configuration
The application automatically detects Codespaces and configures:

**Frontend** (`.env`):
```
VITE_API_BASE_URL=https://{codespace-name}-3001.app.github.dev
VITE_FRONTEND_URL=https://{codespace-name}-5175.app.github.dev
```

**Backend** (`backend/.env`):
```
FRONTEND_URL=https://{codespace-name}-5175.app.github.dev
BACKEND_URL=https://{codespace-name}-3001.app.github.dev
```

## Accessing the Application

Once started, click the popup notification or:
1. Open "Ports" tab in VS Code
2. Click the 🌐 icon next to port 5175 for frontend
3. Click the 🌐 icon next to port 3001 for backend API

## Troubleshooting

### Dependencies Didn't Install Automatically

If the `postCreateCommand` failed:
```bash
npm install
cd backend
npm install
```

Then try starting again with `./start.sh`.

### Backend Still Won't Start

1. Check if dependencies are installed:
```bash
cd backend
ls -la node_modules/ | head
```

2. Try manual install:
```bash
cd backend
npm install
npm run dev
```

3. Check for errors:
```bash
cat backend.log
```

### Port Already in Use

Kill existing processes:
```bash
lsof -ti:3001 | xargs kill -9
lsof -ti:5175 | xargs kill -9
```

### "Backend not configured" Error

1. Stop all processes
2. Delete `.env` files:
```bash
rm .env backend/.env
```

3. Run `./start.sh` again

### Need to Reinstall Everything

Rebuild the Codespace:
1. Command Palette (Ctrl/Cmd + Shift + P)
2. Type "Codespaces: Rebuild Container"
3. Confirm and wait for rebuild

## Manual Setup (Alternative)

If you prefer not to use `start.sh`:

**Terminal 1 - Backend:**
```bash
cd backend
npm install  # First time only
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm install  # First time only
npm run dev
```

**Terminal 3 - Create .env files:**
```bash
# Frontend .env
cat > .env << EOF
VITE_API_BASE_URL=https://${CODESPACE_NAME}-3001.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}
VITE_FRONTEND_URL=https://${CODESPACE_NAME}-5175.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}
EOF

# Backend .env
cat > backend/.env << EOF
PORT=3001
FRONTEND_URL=https://${CODESPACE_NAME}-5175.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}
EOF
```

## Expected Output

### When Opening Codespace:
```
Running postCreateCommand...
npm install
added 300 packages in 15s
cd backend && npm install
added 526 packages in 8s
Done!
```

### When Running start.sh:
```
🚀 Starting InsureTrack...

📋 Configuration Summary:
  Frontend: https://your-codespace-5175.app.github.dev
  Backend:  https://your-codespace-3001.app.github.dev

🔧 Starting backend server...
⏳ Waiting for backend to initialize...
✅ Backend running (PID: 1234)
🎨 Starting frontend...
```

### Backend Console:
```
compliant.team Backend running on http://localhost:3001
Environment: development
CORS allowed: https://your-codespace-5175.app.github.dev
✅ Security: Helmet enabled, Rate limiting active
```

## Files Changed

### New Files:
- `.devcontainer/devcontainer.json` - Codespaces configuration
- `.devcontainer/README.md` - Detailed Codespaces documentation

### Modified Files:
- `start.sh` - Enhanced error handling
- `CODESPACES_FIX_SUMMARY.md` - This file

## Additional Resources

- See `.devcontainer/README.md` for detailed Codespaces documentation
- See `QUICKSTART.md` for general setup instructions
- See `README.md` for complete application documentation

## Summary of All Fixes

✅ **Automatic dependency installation** via devcontainer
✅ **Enhanced error visibility** in start.sh
✅ **Correct backend URL configuration** (previously fixed)
✅ **Port forwarding** automatically configured
✅ **VS Code extensions** automatically installed
✅ **Better documentation** for troubleshooting

## For Developers

The devcontainer configuration ensures:
1. Consistent Node.js version (20)
2. All dependencies pre-installed
3. Proper port forwarding
4. Development extensions available
5. No manual setup required

This makes onboarding new developers much easier - just open in Codespaces and start coding!

