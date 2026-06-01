set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

scan_roots=()
for dir in apps packages; do
  if [[ -d "$dir" ]]; then
    scan_roots+=("$dir")
  fi
done

if [[ "${#scan_roots[@]}" -eq 0 ]]; then
  echo "No scan roots (apps/packages) found."
  exit 0
fi

# Spreading a lens/narrowing flattens the parent chain and silently drops narrowing
# layers (redaction omits, scope-where). Compose by NESTING instead: { parent: prev, ... }.
pattern='\.\.\.[A-Za-z_][A-Za-z0-9_]*([Ll]ens|[Nn]arrowing)'

if grep -rnE --include='*.ts' --include='*.tsx' "$pattern" "${scan_roots[@]}" >/dev/null 2>&1; then
  echo "Found forbidden spread of a lens/narrowing (nest via { parent: ... } instead):"
  grep -rnE --include='*.ts' --include='*.tsx' "$pattern" "${scan_roots[@]}"
  exit 1
fi

echo "No lens/narrowing spreads found."
