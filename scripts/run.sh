#!/usr/bin/env bash
# Pornește PocketBase + Vite împreună. Ctrl+C (SIGINT) oprește ambele.
set -u
cd "$(dirname "$0")/.."

./pocketbase serve --http=127.0.0.1:8090 &
PB_PID=$!

PORT="${PORT:-8443}" npm run dev &
VITE_PID=$!

cleanup() {
  kill "$PB_PID" "$VITE_PID" 2>/dev/null
  pkill -P "$VITE_PID" 2>/dev/null
  wait 2>/dev/null
}
trap cleanup INT TERM

wait
