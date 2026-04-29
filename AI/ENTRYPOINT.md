# AI ENTRYPOINT

Canonical instructions for all coding agents in this repository.
`AGENTS.md` and `CLAUDE.md` should symlink to this file.

## 0. Purpose and Priority

**This is a template, not a product.** Developer experience (DX) is the #1 priority. Every decision — naming, file structure, API design, decomposition — should optimize for the next developer who reads the code.

- **Naming matters.** If a name doesn't clearly describe what the thing does, rename it. Do not leave misleading or generic names for convenience.
- **One file, one concern.** Each file should have a single clear purpose. If a file has multiple exported functions that serve different consumers, split them. The cost of an extra file is near zero; the cost of hunting through a multi-purpose file is real.
- **No premature features.** Do not build things nobody is using yet unless they are foundational patterns that every app page will need. When in doubt, ask.
- **No continuous support debt.** Build things that are self-explanatory and do not require hand-holding. If a consumer needs to read the source code to understand the API, the API is wrong.
- **Adversarial reviews should run regularly.** After any significant implementation, run an adversarial review in the background against the full scope of changes. Do not wait for the user to ask. Flag issues proactively.

## 0.0 Critical Guardrails

- Do not bypass failures by editing CI rules/fixtures.
- Protected paths: `scripts/ci/rules/**`, `scripts/ci/run-ci-rules.sh`, `scripts/ci/rule-violations/**`.
- If a rule fails, fix the violating source code.
- Only change CI rules/fixtures when the user explicitly requests it.
- Prefer minimal, targeted changes over redesigns.
- Do not run git commands unless the user explicitly asks.

## 0.1. Decomposition by Default

Before undertaking any task or planning any approach, decompose first. Do not jump to implementation. Break the problem into its atomic concerns before deciding how to solve it.

**Interrogate the problem:**
- What are the distinct concerns here? (ownership, access, usage, lifecycle, rendering, etc.)
- What are the atomic steps of the operation?
- Which parts change independently? Those are separate responsibilities.
- Which parts have different lifecycles? (created at different times, deleted at different times, owned by different entities) Those are separate records.
- Who owns this data? Who controls access to it? Who consumes it, and in what context? If the answers differ, they are different models.

**The lazy instincts to resist:**
- "Just add a field" — stop. Is this the same concern as the model you're modifying, or a new concern wearing the same clothes?
- "Just store the URL" — stop. Is something else going to need to know about this reference? Then it's a binding, not a string.
- "Just copy the logic" — stop. Is this the same operation in a different context, or a genuinely different operation? Same operation = shared abstraction. Different operation = keep separate even if they look similar.
- "Just put it all in one table/function/component" — stop. Convenience now is coupling later.

Never merge distinct concerns into one place for convenience — the convenience is temporary, the coupling is permanent. When the impulse is to do the quick thing, pause and ask whether the quick thing creates a coupling that will cost more later. If the decomposed version is only marginally more work, do it. The codebase should get more decomposed over time, not less.

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

## 6. App Events & Side Effects

Business logic NEVER calls email, SMS, analytics, or notification services directly. All side effects go through app events.

**Why:** Every SaaS starts with direct calls (`sendEmail()` in controllers), accumulates coupling (adding SMS means touching every controller), hits reliability issues (email provider down → API fails), and eventually migrates to an event bus. We skip that migration.

**Pattern:** `emitAppEvent(name, data)` → handler → bridges (email/websocket/observe) → BullMQ jobs → external services. Nothing synchronous hits external services in the request path.

**Key rules:**
- `emitAppEvent` mirrors `enqueueJob` — typed name, typed payload, centralized map in `appEvents/handlers/index.ts`.
- `makeAppEvent(handler)` returns a handler function — like `makeJob`.
- Each bridge (email, websocket, observe) is independent via `Promise.allSettled`.
- Actor context auto-enriches from `auditActorContext` (AsyncLocalStorage) — never pass actorId manually.
- Events inside `db.txn()` defer to `onCommit`. Events outside run immediately.
- Adapter registries use `makeBroadcastRegistry` — `get()` for pick-one, `broadcast()` for fan-out.
- Observe always goes through a BullMQ job (`recordAppEvent`), never sync DB writes in request path.
- Email targeting is declarative (`userIds`, `orgRole`, `spaceRole`, `raw`) — resolution happens in the job worker.
- Read `docs/claude/APP_EVENTS.md` before modifying the event system.

## 7. Core Engineering Standards

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

## 8. Imports and Exports

- In apps: use `#/` for app-local imports.
- In packages: use `@template/<pkg>/*` absolute imports.
- No relative imports in source (`./`, `../`) except barrel/index files.
- App code must not use `##/` or `~/`.
- Package code must not use `#/`, `##/`, or `~/`.
- Prefer package subpath imports over broad root imports.

## 9. Frontend/Store/Auth Conventions

- Zustand slice composition is standard.
- Web/Admin: tenant-context aware slices.
- Superadmin: user-context first, no forced tenant behavior.
- Prefer existing permix checks and guards.
- OAuth/provider credentials must support encrypt/decrypt (not hashing).
- Platform role `superadmin` is explicit bypass in permission checks.

## 10. Testing and Validation

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

## 11. Quick Doc Routing

Read docs based on task type:

- API/routes/controllers: `docs/claude/API_ROUTES.md`
- DB/schema/hooks: `docs/claude/DATABASE.md`, `docs/claude/HOOKS.md`
- Permissions/auth: `docs/claude/PERMISSIONS.md`, `docs/claude/AUTH.md`, `docs/claude/AUTHENTICATION.md`
- Frontend/state/tables: `docs/claude/FRONTEND.md`, `docs/claude/ZUSTAND.md`
- Jobs/Redis/logging: `docs/claude/JOBS.md`, `docs/claude/REDIS.md`, `docs/claude/LOGGING.md`
- App events/email/notifications: `docs/claude/APP_EVENTS.md`
- Init script work: read `docs/claude/INIT_SCRIPT_PATTERNS.md` first
- Scripts/tooling/env: `docs/claude/SCRIPTS.md`, `docs/claude/ENVIRONMENTS.md`, `docs/claude/DEVELOPER.md`
- Architecture/monorepo: `docs/claude/ARCHITECTURE.md`, `docs/claude/MONOREPO.md`

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
