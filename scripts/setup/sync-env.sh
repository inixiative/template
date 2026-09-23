#!/bin/bash
set -euo pipefail

KEY_LINE='^(export[[:space:]]+)?([A-Z_][A-Z0-9_]*)[[:space:]]*='

unescaped_quotes() {
  local s="$1"
  s="${s//\\\\/}"
  s="${s//\\\"/}"
  s="${s//[^\"]/}"
  printf '%s' "${#s}"
}

value_opens_quote() {
  local v="$1"
  v="${v#"${v%%[![:space:]]*}"}"
  case "$v" in
    \"*) [ "$(unescaped_quotes "${v#\"}")" -eq 0 ] && printf '"' ;;
    \'*) [[ "${v#\'}" != *\'* ]] && printf "'" ;;
  esac
  return 0
}

line_closes_quote() {
  if [ "$1" = '"' ]; then [ "$(unescaped_quotes "$2")" -ge 1 ]; else [[ "$2" == *\'* ]]; fi
}

sync_env() {
  local env_file="$1" example_file="$2"
  local line key="" open="" start=0 lineno=0 missing=0
  local entry=()

  [ -f "$example_file" ] || return 0

  if [ ! -f "$env_file" ]; then
    cp "$example_file" "$env_file"
    echo "Created $env_file"
    return 0
  fi

  flush_entry() {
    if [ "$missing" -eq 1 ]; then
      printf '%s\n' "${entry[@]}" >> "$env_file"
      echo "Added $key to $env_file"
    fi
    entry=()
    missing=0
  }

  while IFS= read -r line || [ -n "$line" ]; do
    lineno=$((lineno + 1))
    line="${line%$'\r'}"
    if [ -n "$open" ]; then
      entry+=("$line")
      if line_closes_quote "$open" "$line"; then
        open=""
        flush_entry
      fi
      continue
    fi
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ $KEY_LINE ]] || continue
    key="${BASH_REMATCH[2]}"
    entry=("$line")
    missing=0
    grep -qE "^(export[[:space:]]+)?${key}[[:space:]]*=" "$env_file" || missing=1
    open="$(value_opens_quote "${line#*=}")"
    if [ -n "$open" ]; then
      start=$lineno
    else
      flush_entry
    fi
  done < "$example_file"

  if [ -n "$open" ]; then
    echo "sync-env: unterminated quote in $example_file — the value of $key opened at line $start never closes" >&2
    exit 1
  fi
}

sync_env ".env.local" ".env.local.example"
sync_env ".env.test" ".env.test.example"

for app in api web admin superadmin; do
  app_dir="apps/$app"
  [ -d "$app_dir" ] || continue
  sync_env "$app_dir/.env.local" "$app_dir/.env.local.example"
  sync_env "$app_dir/.env.test" "$app_dir/.env.test.example"
done
