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

pattern='Array\.isArray\([^)]*\) *\? *[^:]*: *\[[^]]'

if grep -rnE --include='*.ts' --include='*.tsx' "$pattern" "${scan_roots[@]}" >/dev/null 2>&1; then
  echo "Found forbidden Array.isArray casting ternary (use castArray from lodash-es instead):"
  grep -rnE --include='*.ts' --include='*.tsx' "$pattern" "${scan_roots[@]}"
  exit 1
fi

echo "No Array.isArray casting ternaries found."
