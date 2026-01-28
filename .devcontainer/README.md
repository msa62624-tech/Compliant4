# Using Compliant4 in GitHub Codespaces

## Automatic Setup

When you open this repository in GitHub Codespaces, the environment will automatically:
1. Install Node.js 20
2. Install frontend dependencies (`npm install`)
3. Install backend dependencies (`cd backend && npm install`)
4. Forward ports 5175 (frontend) and 3001 (backend)

This is configured in `.devcontainer/devcontainer.json`.

## Starting the Application

### Option 1: Automatic Start (Recommended)
```bash
./start.sh
```

This single command will:
- Create necessary `.env` files with Codespaces URLs
- Start the backend server on port 3001
- Start the frontend dev server on port 5175

### Option 2: Manual Start (Two Terminals)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## Accessing the Application

Once started, Codespaces will automatically forward the ports. You can access:
- **Frontend**: Click the "Open in Browser" notification or go to the "Ports" tab
- **Backend API**: Available at `https://{codespace-name}-3001.app.github.dev`

The `start.sh` script automatically configures the correct URLs for Codespaces.

## Environment Configuration

The application automatically detects Codespaces using the `CODESPACE_NAME` environment variable and configures URLs accordingly:

- **Frontend URL**: `https://{codespace-name}-5175.app.github.dev`
- **Backend URL**: `https://{codespace-name}-3001.app.github.dev`

These are set in:
- Frontend: `.env` → `VITE_API_BASE_URL`
- Backend: `backend/.env` → `FRONTEND_URL`

## Troubleshooting

### Backend Won't Start

If you see `Cannot find package 'express'` or similar errors:

```bash
cd backend
npm install
npm run dev
```

The dependencies should be installed automatically, but if the `postCreateCommand` failed, run it manually.

### Port Forwarding Issues

1. Open the "Ports" tab in VS Code
2. Verify ports 3001 and 5175 are forwarded
3. Set visibility to "Public" if you need to share the link
4. Copy the forwarded URL and paste it in your browser

### "Backend not configured" Error

This means the frontend can't reach the backend. Check:

1. Backend is running on port 3001
2. `.env` file has correct `VITE_API_BASE_URL` pointing to port 3001
3. Backend `.env` has correct `FRONTEND_URL` pointing to port 5175

Run `./start.sh` again to auto-configure these.

### Rebuild Container

If things are really broken:

1. Command Palette (Ctrl/Cmd + Shift + P)
2. Type "Codespaces: Rebuild Container"
3. Wait for rebuild and dependencies to reinstall

## VSCode Extensions

The following extensions are automatically installed:
- ESLint
- Prettier
- Tailwind CSS IntelliSense

## Known Limitations

- Data persists only while the Codespace is running
- Codespace will auto-suspend after inactivity
- Uploaded files are stored in the container filesystem

## Getting Help

- Check `backend.log` for backend errors
- Check browser console (F12) for frontend errors
- Review the main [README.md](../README.md) for general documentation
