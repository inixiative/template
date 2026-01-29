#!/bin/bash
# HMR for API with full restart on workspace package changes
set -e

cd "$(dirname "$0")/../../apps/api"

TRIGGER_FILES=("../../packages/db/.prisma-generated")
BUN_PID="" WATCHER_PID=""

cleanup() {
  [ -n "$WATCHER_PID" ] && { pkill -P $$ fswatch 2>/dev/null; kill $WATCHER_PID 2>/dev/null; } || true
  [ -n "$BUN_PID" ] && { kill -TERM $BUN_PID 2>/dev/null; sleep 0.5; kill -KILL $BUN_PID 2>/dev/null; } || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

start() { bun --hot --no-clear-screen src/index.ts & BUN_PID=$!; }

restart() {
  echo "Restarting API (workspace change)..."
  [ -n "$BUN_PID" ] && { kill -TERM $BUN_PID 2>/dev/null; sleep 0.5; kill -KILL $BUN_PID 2>/dev/null; } || true
  start
}

command -v fswatch &>/dev/null || { echo "fswatch required: brew install fswatch"; exit 1; }

start
fswatch -0 "${TRIGGER_FILES[@]}" | while read -d "" _; do restart; done &
WATCHER_PID=$!
wait $WATCHER_PID
