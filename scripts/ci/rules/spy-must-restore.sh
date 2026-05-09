#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

scan_roots=()
for dir in apps packages; do
  [[ -d "$dir" ]] && scan_roots+=("$dir")
done

if [[ "${#scan_roots[@]}" -eq 0 ]]; then
  echo "No scan roots (apps/, packages/); skipping spy-must-restore."
  exit 0
fi

# Any test file using `spyOn(` must also reference `mock.restore()` or
# `.mockRestore()`. Bun spies persist across tests until restored, so a test
# that spies without restoring leaks behavior into siblings — and `mock.restore`
# is only callable from a lifecycle hook, so the file-local grep is enough to
# catch the leak vector.
files_with_spy=$(grep -rl \
  --include='*.test.ts' \
  --include='*.test.tsx' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=generated \
  'spyOn(' "${scan_roots[@]}" 2>/dev/null || true)

if [[ -z "$files_with_spy" ]]; then
  echo "No spyOn usage in tests."
  exit 0
fi

violations=()
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  if ! grep -Eq 'mock\.restore\(\)|\.mockRestore\(\)' "$file"; then
    violations+=("$file")
  fi
done <<< "$files_with_spy"

if [[ "${#violations[@]}" -gt 0 ]]; then
  echo "Test files use spyOn but never call mock.restore() or .mockRestore() — spies leak across tests:"
  printf '  %s\n' "${violations[@]}"
  exit 1
fi

echo "All spyOn usages are paired with restoration."
