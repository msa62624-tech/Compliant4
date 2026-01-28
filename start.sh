#!/bin/bash

# Complete startup script for InsureTrack application
# This script starts both backend and frontend with all configurations

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

if [ ! -f "backend/.env" ]; then
    echo "⚠️  Backend .env file missing - creating with default settings..."
    cat > backend/.env << EOF
PORT=3001
NODE_ENV=development
JWT_SECRET=insuretrack-secret-2026-change-in-production
FRONTEND_URL=${FRONTEND_URL_DEFAULT}
BACKEND_URL=${BACKEND_URL_DEFAULT}
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
    if grep -q "^FRONTEND_URL=" backend/.env; then
        if [ "$FRONTEND_URL_DEFAULT" != "http://localhost:5175" ]; then
            sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${FRONTEND_URL_DEFAULT}|" backend/.env
        fi
    else
        echo "FRONTEND_URL=${FRONTEND_URL_DEFAULT}" >> backend/.env
    fi

    if grep -q "^BACKEND_URL=" backend/.env; then
        if [ "$BACKEND_URL_DEFAULT" != "http://localhost:3001" ]; then
            sed -i "s|^BACKEND_URL=.*|BACKEND_URL=${BACKEND_URL_DEFAULT}|" backend/.env
        fi
    else
        echo "BACKEND_URL=${BACKEND_URL_DEFAULT}" >> backend/.env
    fi
fi

echo ""
echo "📋 Configuration Summary:"
echo "  Frontend: ${FRONTEND_URL_DEFAULT}"
echo "  Backend:  ${BACKEND_URL_DEFAULT}"
echo "  Email:    miriamsabel@insuretrack.onmicrosoft.com"
echo ""

# Start backend in background
echo "🔧 Starting backend server..."
cd backend

# Install backend dependencies with error checking
if ! npm install > /dev/null 2>&1; then
    echo "⚠️  Backend npm install had issues, trying with output..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install backend dependencies"
        cd ..
        exit 1
    fi
fi

node server.js > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo "⏳ Waiting for backend to initialize..."
sleep 3

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
    echo "⚠️  Frontend npm install had issues, trying with output..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install frontend dependencies"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
fi

npm run dev

# Cleanup on exit
trap "echo ''; echo '🛑 Shutting down...'; kill $BACKEND_PID 2>/dev/null; exit 0" EXIT INT TERM
