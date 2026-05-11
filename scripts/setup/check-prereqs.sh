#!/bin/bash
set -euo pipefail

command -v bun &> /dev/null || { echo "Error: Bun not installed"; exit 1; }

# Version check — engines.bun is pinned in package.json, so we enforce exact
# match here. Catches the "wrong bun" footgun at the prereq gate rather than
# letting devs hit confusing failures deep in setup.
required=$(bun -e 'console.log(require("./package.json").engines.bun)')
current=$(bun --version)
[ "$current" = "$required" ] || { echo "Error: Bun $required required, found $current. Run: bun upgrade --tag bun-v$required"; exit 1; }

command -v docker &> /dev/null || { echo "Error: Docker not installed"; exit 1; }
docker info &> /dev/null || { echo "Error: Docker not running"; exit 1; }
