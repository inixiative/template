#!/bin/bash
# Syncs external agent skills declared in manifest.json.
# External skills go to .agents/skills/.cache/ (gitignored).
# Project-level skills in .claude/skills/ etc. are left alone.
#
# Usage:
#   bash AI/skills/sync.sh          # install skills-cli skills
#   bash AI/skills/sync.sh --all    # also print plugin install reminders
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MANIFEST="$SCRIPT_DIR/manifest.json"
CACHE_DIR="$ROOT_DIR/.agents/skills/.cache"

if ! command -v bun &>/dev/null; then
  echo "Error: bun is required. Install from https://bun.sh" >&2
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo "Error: manifest.json not found at $MANIFEST" >&2
  exit 1
fi

mkdir -p "$CACHE_DIR"

echo "Syncing agent skills from manifest..."

# Install skills-cli skills via bunx
SKILLS_CLI_SOURCES=$(bun -e "
  const m = require('$MANIFEST');
  const sources = [...new Set(m.skills.filter(s => s.method === 'skills-cli').map(s => s.source))];
  sources.forEach(s => console.log(s));
")

for source in $SKILLS_CLI_SOURCES; do
  echo "Installing skills from $source..."
  bunx skills add "$source" || {
    echo "Warning: Failed to install skills from $source. Retrying..." >&2
    sleep 2
    bunx skills add "$source" || echo "Warning: Retry failed for $source. Skipping." >&2
  }
done

# Plugin reminders (plugins require interactive agent session)
if [ "$1" = "--all" ]; then
  echo ""
  echo "=== Plugin Skills (install manually in agent session) ==="
  bun -e "
    const m = require('$MANIFEST');
    m.skills.filter(s => s.method === 'plugin').forEach(s => {
      console.log('  Claude Code: /plugin install ' + s.name + '@claude-plugins-official');
      console.log('  Cursor:      /add-plugin ' + s.name);
      console.log('');
    });
  "
fi

echo "Skill sync complete."
