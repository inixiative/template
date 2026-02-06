#!/bin/bash
set -e

ENV=${1:-prod}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/dump.sh" "$ENV"
"$SCRIPT_DIR/restore.sh" "$ENV"
bun run with local api bun run db:deploy
bun run db:truncate:webhooks
echo "Cloned: $ENV → local"
