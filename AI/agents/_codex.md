# Codex Agent

## Startup sequence

1. Read `AI/ENTRYPOINT.md` (canonical rules)
2. Read `AI/rules/` files relevant to the task domain
3. Use §11 doc routing in ENTRYPOINT to find task-specific docs

## Memory — repo is the system of record

Everything not in the repo is illegible. Architectural decisions, conventions,
resolved bugs — encode them in the repo.

- `AI/rules/` is the canonical golden-rule store; add validated findings here

## Coordination pattern

- Work on isolated git branches
- PR is the handoff unit — leave structured context in the PR description
- Claude Code handles planning/orchestration; Codex handles isolated implementation

## Rules enforcement

CI enforces `scripts/ci/rules/`. Violations include remediation instructions.
Before opening a PR, run: `bash scripts/ci/run-ci-rules.sh`
