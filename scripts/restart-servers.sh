#!/usr/bin/env bash
# Restart helper: free common ports (3001,5173,5175), start backend and frontend, and show logs
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

echo "[restart-servers] Running from: $ROOT_DIR"

kill_by_port() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti :${port} || true)
    if [ -n "$pids" ]; then
      echo "[restart-servers] Killing PIDs on port ${port}: $pids"
      echo $pids | xargs -r kill -9
    fi
  else
    echo "[restart-servers] lsof not found; skipping kill by port for ${port}"
  fi
}

echo "[restart-servers] Freeing ports 3001, 5173, 5175 (if occupied)"
for p in 3001 5173 5175; do
  kill_by_port $p
done

echo "[restart-servers] Starting backend"
if [ -d "$BACKEND_DIR" ]; then
  cd "$BACKEND_DIR"
  npm install --silent || true
  nohup node --watch server.js > server.log 2>&1 &
  BACKEND_PID=$!
  echo "[restart-servers] Backend started (PID: $BACKEND_PID)"
else
  echo "[restart-servers] Backend directory not found: $BACKEND_DIR"
  exit 1
fi

echo "[restart-servers] Starting frontend"
cd "$ROOT_DIR"
npm install --silent || true
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "[restart-servers] Frontend started (PID: $FRONTEND_PID)"

sleep 3

echo "\n[restart-servers] Current listeners for ports 3001/5173/5175:"
if command -v ss >/dev/null 2>&1; then
  ss -ltnp | grep -E ':3001|:5173|:5175' || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -iTCP -sTCP:LISTEN -Pn | grep -E '3001|5173|5175' || true
else
  echo "[restart-servers] ss/lsof not available to list listeners"
fi

echo "\n[restart-servers] Backend log (last 80 lines):"
tail -n 80 "$BACKEND_DIR/server.log" || true

echo "\n[restart-servers] Frontend log (last 40 lines):"
tail -n 40 "$ROOT_DIR/frontend.log" || true

echo "\n[restart-servers] Done. If services failed to start, inspect server.log and frontend.log in the repo root/backend." 
