#!/bin/bash
set -e

# Read a value from project.config.ts by dot-path and print to stdout.
# Empty string if the path doesn't resolve (use `[ -n "$X" ]` to detect).
#
# Examples:
#   $(bash read-project-config.sh infisical.projectId)
#   $(bash read-project-config.sh features.staging.enabled)   # → "true" / "false"
#   $(bash read-project-config.sh apps.web.enabled)

KEY=$1
if [ -z "$KEY" ]; then
    echo "Usage: $0 <dot.path.to.value>" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../.."

CONFIG_FILE=$(bash "$SCRIPT_DIR/locate-config.sh")

cd "$ROOT_DIR"

bun -e "
import { projectConfig } from './$CONFIG_FILE';
const value = '$KEY'.split('.').reduce((o, k) => o?.[k], projectConfig);
if (value === undefined || value === null) process.stdout.write('');
else if (typeof value === 'boolean') process.stdout.write(value ? 'true' : 'false');
else process.stdout.write(String(value));
" 2>/dev/null
