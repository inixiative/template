#!/bin/bash
# kill-local-ports.sh - Kill processes on local dev ports before starting
#
# Worktree-aware: reads ports from .env.local if WORKTREE_SLOT is set,
# falls back to default ports.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

if [ -f "$ENV_FILE" ]; then
  SLOT="$(grep -m1 '^WORKTREE_SLOT=' "$ENV_FILE" | cut -d= -f2 || true)"
fi

if [ -n "${SLOT:-}" ]; then
  PORTS=("8${SLOT}00" "3${SLOT}00" "3${SLOT}01" "3${SLOT}02")
else
  PORTS=(8000 3000 3001 3002)
fi

echo "Cleaning up local dev ports: ${PORTS[*]}"

for PORT in "${PORTS[@]}"; do
  PID=$(lsof -ti:"$PORT" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    kill -9 "$PID" 2>/dev/null || true
    echo "  Killed PID $PID on port $PORT"
  fi
done
