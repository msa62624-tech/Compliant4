#!/bin/bash

# Stop all node processes
echo "🛑 Stopping all services..."
pkill -f "node server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

echo "✅ All services stopped"
echo ""
echo "To restart, run:"
echo "  ./start.sh"
