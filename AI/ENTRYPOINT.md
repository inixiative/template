# AI ENTRYPOINT

Canonical instructions for all coding agents in this repository.
`AGENTS.md` and `CLAUDE.md` should symlink to this file.

## 0. Critical Guardrails

- Do not bypass failures by editing CI rules/fixtures.
- Protected paths: `scripts/ci/rules/**`, `scripts/ci/run-ci-rules.sh`, `scripts/ci/rule-violations/**`.
- If a rule fails, fix the violating source code.
- Only change CI rules/fixtures when the user explicitly requests it.
- Prefer minimal, targeted changes over redesigns.
- Do not run git commands unless the user explicitly asks.

## 1. Mandatory Task Intake (Always)

Before editing, restate:

- `Mode`: minimal by default.
- `Scope`: exact files/modules to touch (`1-3` files unless expanded by user).
- `Goal`: one concrete outcome.
- `Non-goals`: what must not change.
- `Pattern`: local pattern/module to reuse.
- `Abstractions`: no new wrappers/types/hooks unless requested.
- `Validation`: exact commands to run.
- `Stop condition`: stop after first passing validation for scope.
- `Tooling constraints`: no git unless requested.

If critical info is missing, ask one short clarification question.

## 2. Execution Contract

1. Show a brief issue list and exact patch plan before edits.
2. Apply the smallest patch that solves the requested problem.
3. Run only agreed validations.
4. If blocked, stop and ask; do not branch into redesigns.
5. Report exact files changed and validation output.

Calibration default:

1. Restate scope/goal/non-goals.
2. Propose minimal patch plan.
3. Wait for user approval.
4. Implement approved patch only.
5. Report results.

## 3. Circuit Breaker (Stop and Ask)

Pause and request approval if any occur:

- Scope expands beyond agreed modules.
- More than `3` files needed for a minimal task.
- More than `2` failed attempts on same issue.
- New abstraction appears required but unrequested.
- Signature changes across multiple callers are needed.
- You cannot explain fix in 3 concise bullets.

When tripped, provide:

1. What changed from original scope.
2. Options `A/B/C` with tradeoffs.
3. Recommended next patch.

## 4. Pattern Discovery Before Implementation

Before writing new code (especially non-trivial tasks):

1. Find `2-3` similar modules.
2. Extract concrete local patterns (types, access, validation, errors, permissions).
3. Confirm pattern choice with user when uncertain/high-impact.
4. Then implement.

Testing-specific pattern discovery:

- Prefer factories in `packages/db/src/test/factories`.
- Use `build*` (in-memory) and `create*` (persisted) patterns.
- Avoid hand-built DB records when a factory exists.

## 5. Monorepo Map

- Apps: `/apps/web`, `/apps/admin`, `/apps/superadmin`, `/apps/api`
- Packages: `/packages/db`, `/packages/shared`, `/packages/ui`, `/packages/permissions`, `/packages/email`
- Docs source of truth: `/docs/claude/*`

## 6. Core Engineering Standards

- Reuse existing utilities/types before introducing new ones.
- Avoid signature churn; prefer additive optional fields.
- Keep logic single-source; remove stale duplication.
- Security defaults: auth checks, permission checks, tenant boundaries.
- Secrets: encrypted at rest; never returned in API responses.
- Type safety: avoid `any`; import canonical types from source modules.

Top-tier feature bar (auth/permissions/CRUD/nav/forms/notifications/settings):

- Clear contracts (stable API/types)
- Safe defaults
- Consistent errors
- Complete UX states
- End-to-end typing
- Critical test coverage
- Observability
- Minimal docs updates when behavior/contracts change

## 7. Imports and Exports

- In apps: use `#/` for app-local imports.
- In packages: use `@template/<pkg>/*` absolute imports.
- No relative imports in source (`./`, `../`) except barrel/index files.
- App code must not use `##/` or `~/`.
- Package code must not use `#/`, `##/`, or `~/`.
- Prefer package subpath imports over broad root imports.

## 8. Frontend/Store/Auth Conventions

- Zustand slice composition is standard.
- Web/Admin: tenant-context aware slices.
- Superadmin: user-context first, no forced tenant behavior.
- Prefer existing permix checks and guards.
- OAuth/provider credentials must support encrypt/decrypt (not hashing).
- Platform role `superadmin` is explicit bypass in permission checks.

## 9. Testing and Validation

Use focused checks first:

- `bun run --cwd <workspace> typecheck`
- `bun run --cwd <workspace> test`

Canonical completion rule:

- For code changes, do not declare the task complete after only scoped checks unless the user explicitly narrowed validation.
- After focused checks pass, run `bun run check` as the repo-level final verification command.
- `bun run check` is the canonical full sweep: Biome/lint, monorepo typecheck, backend/package tests, frontend tests, and CI rules.
- Do not substitute a partial subset of those checks and report the work as fully validated.

If cross-package types/imports changed, typecheck each affected workspace.

CI rule runner:

- Normal: `bash scripts/ci/run-ci-rules.sh`
- Self-test: `bash scripts/ci/run-ci-rules.sh --test`

Rule fixture layout:

- `scripts/ci/rule-violations/<rule>/pass[/<case>]`
- `scripts/ci/rule-violations/<rule>/fail[/<case>]`

## 10. Quick Doc Routing

Read docs based on task type:

- API/routes/controllers: `docs/claude/API_ROUTES.md`
- DB/schema/hooks: `docs/claude/DATABASE.md`, `docs/claude/HOOKS.md`
- Permissions/auth: `docs/claude/PERMISSIONS.md`, `docs/claude/AUTH.md`, `docs/claude/AUTHENTICATION.md`
- Frontend/state/tables: `docs/claude/FRONTEND.md`, `docs/claude/ZUSTAND.md`
- Jobs/Redis/logging: `docs/claude/JOBS.md`, `docs/claude/REDIS.md`, `docs/claude/LOGGING.md`
- Init script work: read `docs/claude/INIT_SCRIPT_PATTERNS.md` first
- Scripts/tooling/env: `docs/claude/SCRIPTS.md`, `docs/claude/ENVIRONMENTS.md`, `docs/claude/DEVELOPER.md`
- Architecture/monorepo: `docs/claude/ARCHITECTURE.md`, `docs/claude/MONOREPO.md`

## 11. AI Memory System (MuninnDB)

Two MCP-connected memory stores. Use both intelligently:

| Store    | MCP server           | Write when |
|----------|---------------------|------------|
| Template | `muninndb_template` | Golden rules shipped with the template (read-only at runtime) |
| Team     | `muninndb_team`     | Project-specific decisions, resolved bugs, validated conventions |
| Local    | `muninndb_local`    | Session context, in-progress debugging, draft ideas |

**Read order**: `muninndb_template` → `muninndb_team` → `muninndb_local`.
**Write discipline**: only promote to `muninndb_team` once a pattern or finding is validated.

Local: `docker compose up muninndb` — REST (8475), admin UI (8476), MCP (8750). Handled by `bun run setup`.
Shared: provisioned on Railway via `bun run init` → Railway Setup.
New dev onboarding: `bun run init` → Railway Setup generates `.mcp.json`.

See `AI/agents/_muninndb.md` for full connection details per agent.
See `AI/agents/_claude.md` and `AI/agents/_codex.md` for agent-specific startup sequences.

## 12. Tickets and AI Workspace

- Tickets: `tickets/README.md`
- Put deep analysis/reports in `/tmp/AI_WORKSPACE/` to keep chat concise.

## 13. Change Checklist

1. Confirm pattern in nearby modules.
2. Implement minimal fix with existing utilities/types.
3. Keep imports aligned with alias rules.
4. Remove stale/duplicate logic/exports.
5. Run targeted validation.
6. Summarize exactly what changed and why.
