#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULE_DIR="$SCRIPT_DIR/rules"
FIXTURE_DIR="$SCRIPT_DIR/rule-violations"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ ! -d "$RULE_DIR" ]]; then
  echo "Rules directory not found: $RULE_DIR"
  exit 1
fi

run_all_rules() {
  local target_root="$1"
  local exit_code=0

  for rule in "$RULE_DIR"/*.sh; do
    [[ -e "$rule" ]] || continue
    echo "Running $(basename "$rule")"
    if ! bash "$rule" "$target_root"; then
      exit_code=1
    fi
  done

  if [[ "$exit_code" -ne 0 ]]; then
    echo "CI rules failed."
    return 1
  fi

  echo "CI rules passed."
}

run_self_tests() {
  if [[ ! -d "$FIXTURE_DIR" ]]; then
    echo "Fixture directory not found: $FIXTURE_DIR"
    return 1
  fi

  local exit_code=0

  case_dirs_for() {
    local base_dir="$1"
    local has_subdirs=0

    while IFS= read -r dir; do
      has_subdirs=1
      printf '%s\n' "$dir"
    done < <(find "$base_dir" -mindepth 1 -maxdepth 1 -type d | sort)

    if [[ "$has_subdirs" -eq 0 ]]; then
      printf '%s\n' "$base_dir"
    fi
  }

  for rule in "$RULE_DIR"/*.sh; do
    [[ -e "$rule" ]] || continue
    local rule_name
    rule_name="$(basename "$rule" .sh)"
    local pass_root="$FIXTURE_DIR/$rule_name/pass"
    local fail_root="$FIXTURE_DIR/$rule_name/fail"

    if [[ ! -d "$pass_root" || ! -d "$fail_root" ]]; then
      echo "Missing fixtures for $rule_name (expected pass/ and fail/)"
      exit_code=1
      continue
    fi

    while IFS= read -r pass_case; do
      local pass_case_name="${pass_case#$pass_root/}"
      [[ "$pass_case_name" != "$pass_case" ]] || pass_case_name="default"
      echo "Self-test $(basename "$rule"): pass fixture ($pass_case_name)"
      if ! bash "$rule" "$pass_case"; then
        echo "Expected pass but failed: $rule_name ($pass_case_name)"
        exit_code=1
      fi
    done < <(case_dirs_for "$pass_root")

    while IFS= read -r fail_case; do
      local fail_case_name="${fail_case#$fail_root/}"
      [[ "$fail_case_name" != "$fail_case" ]] || fail_case_name="default"
      echo "Self-test $(basename "$rule"): fail fixture ($fail_case_name)"
      if bash "$rule" "$fail_case"; then
        echo "Expected failure but passed: $rule_name ($fail_case_name)"
        exit_code=1
      fi
    done < <(case_dirs_for "$fail_root")
  done

  if [[ "$exit_code" -ne 0 ]]; then
    echo "CI rule self-tests failed."
    return 1
  fi

  echo "CI rule self-tests passed."
}

if [[ "${1:-}" == "--test" ]]; then
  run_self_tests
else
  run_all_rules "$REPO_ROOT"
fi
