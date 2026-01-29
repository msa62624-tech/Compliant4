# Using Compliant4 in GitHub Codespaces

## Automatic Setup

When you open this repository in GitHub Codespaces, the environment will automatically:
1. Install Node.js 20 (for frontend)
2. Install Python 3.11 (for backend)
3. Install frontend dependencies (`npm install`)
4. Install Python backend dependencies including code quality tools (`cd backend-python && pip install -r requirements.txt`)
5. Forward ports 5175 (frontend) and 3001 (backend)
6. Install VS Code extensions for JavaScript/TypeScript and Python development (including Black formatter)

This is configured in `.devcontainer/devcontainer.json`.

## Starting the Application

This repository uses **Python (FastAPI)** as the backend.

### Option 1: Using Automatic Start Script (Recommended)

```bash
./start.sh
```

This will:
- Start the Python backend server on port 3001
- Start the frontend dev server on port 5175
- Create necessary `.env` files with Codespaces URLs

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend-python
# Start the server (dependencies already installed)
uvicorn main:app --reload --host 0.0.0.0 --port 3001
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

> **Note**: Python dependencies are automatically installed during Codespace creation!

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
- Python Backend: `backend-python/.env` → `FRONTEND_URL`

## Troubleshooting

### Python Backend Won't Start

If you see Python import errors or missing packages:

```bash
cd backend-python
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 3001
```

If you prefer using a virtual environment:

```bash
cd backend-python
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 3001
```

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
- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting for JavaScript/TypeScript
- **Tailwind CSS IntelliSense** - Tailwind CSS class completions
- **Python** - Python language support
- **Pylance** - Fast Python language server
- **Black Formatter** - Python code formatter (auto-formats on save)

## Known Limitations

- Data persists only while the Codespace is running
- Codespace will auto-suspend after inactivity
- Uploaded files are stored in the container filesystem

## Getting Help

- Check `backend.log` for backend errors
- Check browser console (F12) for frontend errors
- Review the main [README.md](../README.md) for general documentation
