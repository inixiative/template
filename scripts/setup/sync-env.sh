#!/bin/bash
set -e

example_entry() {
  local example_file="$1" key="$2"
  awk -v key="$key" '
    function unbalanced(s) { n = gsub(/"/, "\"", s); return n % 2 == 1 }
    !printing && index($0, key "=") == 1 { printing = 1; print; if (unbalanced($0)) open = 1; else exit; next }
    printing && open { print; if (unbalanced($0)) exit }
  ' "$example_file"
}

sync_env() {
  local env_file="$1"
  local example_file="$2"
  local line key in_quoted=0

  [ ! -f "$example_file" ] && return 0

  if [ ! -f "$env_file" ]; then
    cp "$example_file" "$env_file"
    echo "Created $env_file"
    return 0
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    if [ "$in_quoted" -eq 1 ]; then
      [ "$(tr -cd '"' <<< "$line" | wc -c)" -eq 1 ] && in_quoted=0
      continue
    fi
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)= ]]; then
      key="${BASH_REMATCH[1]}"
      [ $(( $(tr -cd '"' <<< "$line" | wc -c) % 2 )) -eq 1 ] && in_quoted=1
      if ! grep -q "^${key}=" "$env_file"; then
        example_entry "$example_file" "$key" >> "$env_file"
        echo "Added $key to $env_file"
      fi
    fi
  done < "$example_file"
}

sync_env ".env.local" ".env.local.example"
sync_env ".env.test" ".env.test.example"

for app in api web admin superadmin; do
  app_dir="apps/$app"
  [ -d "$app_dir" ] || continue
  sync_env "$app_dir/.env.local" "$app_dir/.env.local.example"
  sync_env "$app_dir/.env.test" "$app_dir/.env.test.example"
done
