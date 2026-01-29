#!/bin/bash

# Complete startup script for InsureTrack application
# This script starts both Python backend and frontend with all configurations

echo "🚀 Starting InsureTrack..."
echo ""

# Detect Codespaces/public URLs when available
if [ -n "$CODESPACE_NAME" ] && [ -n "$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN" ]; then
    FRONTEND_URL_DEFAULT="https://${CODESPACE_NAME}-5175.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    BACKEND_URL_DEFAULT="https://${CODESPACE_NAME}-3001.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
else
    FRONTEND_URL_DEFAULT="http://localhost:5175"
    BACKEND_URL_DEFAULT="http://localhost:3001"
fi

# Check if .env files exist
if [ ! -f ".env" ]; then
    echo "⚠️  Frontend .env file missing - creating..."
    if [ -n "$CODESPACE_NAME" ] && [ -n "$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN" ]; then
        cat > .env << EOF
VITE_API_BASE_URL=${BACKEND_URL_DEFAULT}
VITE_FRONTEND_URL=${FRONTEND_URL_DEFAULT}
VITE_PROXY_TARGET=http://localhost:3001
EOF
    else
        cat > .env << EOF
VITE_API_BASE_URL=${BACKEND_URL_DEFAULT}
VITE_FRONTEND_URL=${FRONTEND_URL_DEFAULT}
VITE_PROXY_TARGET=http://localhost:3001
EOF
    fi
    echo "✅ Frontend .env created"
else
    if [ -n "$CODESPACE_NAME" ] && [ -n "$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN" ]; then
        if grep -q "^VITE_API_BASE_URL=" .env; then
            sed -i "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=${BACKEND_URL_DEFAULT}|" .env
        else
            echo "VITE_API_BASE_URL=${BACKEND_URL_DEFAULT}" >> .env
        fi
    else
        if grep -q "^VITE_API_BASE_URL=" .env; then
            sed -i "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=${BACKEND_URL_DEFAULT}|" .env
        else
            echo "VITE_API_BASE_URL=${BACKEND_URL_DEFAULT}" >> .env
        fi
    fi

    if grep -q "^VITE_FRONTEND_URL=" .env; then
        if [ "$FRONTEND_URL_DEFAULT" != "http://localhost:5175" ]; then
            sed -i "s|^VITE_FRONTEND_URL=.*|VITE_FRONTEND_URL=${FRONTEND_URL_DEFAULT}|" .env
        fi
    else
        echo "VITE_FRONTEND_URL=${FRONTEND_URL_DEFAULT}" >> .env
    fi

    if grep -q "^VITE_PROXY_TARGET=" .env; then
        sed -i "s|^VITE_PROXY_TARGET=.*|VITE_PROXY_TARGET=http://localhost:3001|" .env
    else
        echo "VITE_PROXY_TARGET=http://localhost:3001" >> .env
    fi
fi

if [ ! -f "backend-python/.env" ]; then
    echo "⚠️  Backend .env file missing - creating with default settings..."
    cat > backend-python/.env << EOF
PORT=3001
FRONTEND_URL=${FRONTEND_URL_DEFAULT}
BACKEND_URL=${BACKEND_URL_DEFAULT}
JWT_SECRET=insuretrack-secret-2026-change-in-production
DATABASE_URL=sqlite:///./data/compliant.db
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=miriamsabel@insuretrack.onmicrosoft.com
SMTP_PASS=Kamentitz1234
SMTP_FROM=miriamsabel@insuretrack.onmicrosoft.com
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
ADMIN_EMAILS=miriamsabel@insuretrack.onmicrosoft.com
EOF
    echo "✅ Backend .env created"
else
    if grep -q "^FRONTEND_URL=" backend-python/.env; then
        if [ "$FRONTEND_URL_DEFAULT" != "http://localhost:5175" ]; then
            sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${FRONTEND_URL_DEFAULT}|" backend-python/.env
        fi
    else
        echo "FRONTEND_URL=${FRONTEND_URL_DEFAULT}" >> backend-python/.env
    fi

    if grep -q "^BACKEND_URL=" backend-python/.env; then
        if [ "$BACKEND_URL_DEFAULT" != "http://localhost:3001" ]; then
            sed -i "s|^BACKEND_URL=.*|BACKEND_URL=${BACKEND_URL_DEFAULT}|" backend-python/.env
        fi
    else
        echo "BACKEND_URL=${BACKEND_URL_DEFAULT}" >> backend-python/.env
    fi
fi

echo ""
echo "📋 Configuration Summary:"
echo "  Frontend: ${FRONTEND_URL_DEFAULT}"
echo "  Backend:  ${BACKEND_URL_DEFAULT}"
echo "  Email:    miriamsabel@insuretrack.onmicrosoft.com"
echo ""

# Start Python backend in background
echo "🔧 Starting Python backend server..."
cd backend-python

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment not found - running setup..."
    ./setup.sh
fi

# Activate virtual environment and start server
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 3001 > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Check if backend is running
if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ Backend running (PID: $BACKEND_PID)"
else
    echo "❌ Backend failed to start. Check backend.log for errors"
    tail -20 backend.log
    exit 1
fi

# Start frontend
echo "🎨 Starting frontend..."

# Install frontend dependencies with error checking
if ! npm install > /dev/null 2>&1; then
    echo "⚠️  Frontend npm install had issues, retrying..."
    # Capture output from retry attempt to a temporary file
    TEMP_LOG=$(mktemp)
    npm install > "$TEMP_LOG" 2>&1
    INSTALL_EXIT_CODE=$?
    if [ $INSTALL_EXIT_CODE -ne 0 ]; then
        echo "❌ Failed to install frontend dependencies"
        cat "$TEMP_LOG"
        rm -f "$TEMP_LOG"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    else
        echo "✅ Frontend dependencies installed successfully on retry"
        rm -f "$TEMP_LOG"
    fi
fi

npm run dev

# Cleanup on exit
trap "echo ''; echo '🛑 Shutting down...'; kill $BACKEND_PID 2>/dev/null; exit 0" EXIT INT TERM
