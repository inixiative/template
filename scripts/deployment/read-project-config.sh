#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <dot.path.to.value>" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../.."

bun -e '
import { getProjectConfig } from "./init/utils/getProjectConfig.ts";
const config = await getProjectConfig();
const value = process.argv[1].split(".").reduce((object, key) => object?.[key], config);
if (value !== undefined && value !== null) process.stdout.write(String(value));
' "$1"
