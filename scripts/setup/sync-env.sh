#!/bin/bash
set -e

# Sync env file with example - creates if missing, adds missing keys
sync_env() {
  local env_file="$1"
  local example_file="$2"

  [ ! -f "$example_file" ] && return 0

  if [ ! -f "$env_file" ]; then
    cp "$example_file" "$env_file"
    echo "Created $env_file"
    return 0
  fi

  # Add missing keys
  while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)= ]]; then
      key="${BASH_REMATCH[1]}"
      if ! grep -q "^${key}=" "$env_file"; then
        grep "^${key}=" "$example_file" >> "$env_file"
        echo "Added $key to $env_file"
      fi
    fi
  done < "$example_file"
}

sync_env ".env.local" ".env.example"
sync_env ".env.test" ".env.test.example"
