set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DETECTOR="$SCRIPT_DIR/lib/uuidv7Ids.ts"

ROOT_DIR="${1:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$ROOT_DIR"

bun "$DETECTOR"
