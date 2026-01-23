#!/bin/bash

# Complete startup script for InsureTrack application
# This script starts both backend and frontend with all configurations

echo "🚀 Starting InsureTrack..."
echo ""

# Check if .env files exist
if [ ! -f ".env" ]; then
    echo "⚠️  Frontend .env file missing - creating..."
    cat > .env << 'EOF'
VITE_API_BASE_URL=http://localhost:3001
EOF
    echo "✅ Frontend .env created"
fi

if [ ! -f "backend/.env" ]; then
    echo "⚠️  Backend .env file missing - creating with default settings..."
    cat > backend/.env << 'EOF'
PORT=3001
NODE_ENV=development
JWT_SECRET=insuretrack-secret-2026-change-in-production
FRONTEND_URL=http://localhost:5175
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
fi

echo ""
echo "📋 Configuration Summary:"
echo "  Frontend: http://localhost:5175"
echo "  Backend:  http://localhost:3001"
echo "  Email:    miriamsabel@insuretrack.onmicrosoft.com"
echo ""

# Start backend in background
echo "🔧 Starting backend server..."
cd backend
npm install > /dev/null 2>&1
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
    exit 1
fi

# Start frontend
echo "🎨 Starting frontend..."
npm install > /dev/null 2>&1
npm run dev

# Cleanup on exit
trap "echo ''; echo '🛑 Shutting down...'; kill $BACKEND_PID 2>/dev/null; exit 0" EXIT INT TERM
