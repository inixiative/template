#!/bin/bash
set -e

# Locate the correct project config file based on USE_INTERNAL_CONFIG
# Outputs the config file name to stdout

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../.."

# Use the TypeScript utility to get the config file path
cd "$ROOT_DIR"

CONFIG_FILE=$(bun -e "
import { projectConfigPath } from './init/utils/fetchProjectConfig.ts';
const path = projectConfigPath();
console.log(path.split('/').pop());
" 2>/dev/null)

if [ -z "$CONFIG_FILE" ]; then
	echo "Error: Failed to locate config file" >&2
	exit 1
fi

echo "$CONFIG_FILE"
