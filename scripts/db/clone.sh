#!/bin/bash
set -e

ENV=${1:-prod}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/dump.sh" "$ENV"
"$SCRIPT_DIR/restore.sh" "$ENV"
bun run db:deploy
echo "Cloned: $ENV → local"
