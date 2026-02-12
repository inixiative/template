# AGENTS.md

Repository-level guidance for coding agents working in this monorepo.

## Purpose

- Keep changes minimal, consistent, and easy to review.
- Reuse existing code paths and conventions before introducing anything new.
- Prefer targeted fixes over broad refactors.

## Mandatory Task Intake (Always)

Before starting any task, collect and restate these constraints:

- `Mode`: minimal by default (no redesigns).
- `Scope`: exact files/modules to touch (`1-3` files unless user expands scope).
- `Goal`: single concrete outcome.
- `Non-goals`: what must not change.
- `Pattern`: existing local pattern/module to reuse.
- `Abstractions`: no new wrappers/types/hooks unless explicitly requested.
- `Validation`: exact command(s) to run.
- `Stop condition`: stop after first passing validation for requested scope.
- `Tooling constraints`: no git commands unless explicitly requested by user.

If any critical item is missing, ask one short clarification question before editing.

Execution contract after intake:

1. Show a brief issue list and exact patch plan before edits.
2. Apply the smallest possible patch only.
3. Run only the agreed validation command(s).
4. If blocked, stop and ask; do not branch into alternate redesigns.

## Calibration Mode (Default Until Stable)

Use this check-in loop on every task unless user explicitly waives it:

1. Restate `scope`, `goal`, and `non-goals` in concise bullets.
2. Propose a minimal patch plan (files + intended edits).
3. Wait for user approval before editing.
4. Apply only the approved patch.
5. Report exact files changed and validation output.

Refinement rule:

- If user gives corrective feedback, update this `AGENTS.md` guidance in the same session so behavior improves over time.

## Circuit Breaker (Anti-Slop)

Stop immediately and ask for approval before continuing if any of these happen:

- Scope expands beyond agreed files/modules.
- More than `3` files need edits for a "minimal" task.
- More than `2` failed fix attempts on the same issue.
- A new abstraction (wrapper/hook/type/helper) seems required but was not requested.
- You are about to change signatures across multiple callers.
- You cannot explain the fix in `3` concise bullets.

When tripped, respond with:

1. What changed from original scope.
2. The minimal safe options (`A`, `B`, `C`) with tradeoffs.
3. A recommendation and the exact next patch.

Do not continue editing until user confirms.

## Monorepo Map

- Apps: `/apps/web`, `/apps/admin`, `/apps/superadmin`, `/apps/api`
- Packages: `/packages/db`, `/packages/shared`, `/packages/ui`, `/packages/permissions`, `/packages/email`
- Docs source of truth: `/docs/claude/*` and `/CLAUDE.md`

## Core Philosophy

- Minimal delta first: fix the smallest surface that solves the issue.
- Pattern match before coding: find 2-3 similar modules and follow them.
- Reuse over reinvention:
  - Do not add new wrappers/hooks if existing utilities already solve it.
  - Do not redeclare types that already exist in canonical modules.
- Avoid signature churn:
  - Do not change established call signatures unless required.
  - Prefer adding optional fields over forcing new required params.
- Keep logic single-source:
  - If logic is duplicated, extract a shared utility and migrate callers.

## Top Tier Feature Standard

For common template features (auth, permissions, CRUD, navigation, forms, notifications, settings), target this quality bar:

- Contract clarity: stable API/types and predictable inputs/outputs.
- Safety by default: auth checks, permission checks, tenant boundaries, validation.
- Error consistency: shared error shape, actionable guidance, request IDs.
- UX completeness: loading, empty, success, and error states.
- Type integrity: end-to-end typing through API/client/store/UI; avoid `any` in core flows.
- Test coverage: happy path plus critical edge cases and regression tests.
- Observability: useful logs and traces for failure diagnosis.
- Documentation: concise usage notes, constraints, and known gotchas.

Definition of done for a feature:

1. Meets all applicable items above.
2. Passes focused typecheck/tests for touched workspaces.
3. Includes minimal docs updates when contracts or behavior change.

## Imports and Exports

- In apps: use `#/` for app-local imports.
- In packages: use `@template/<pkg>/*` absolute imports.
- No relative imports in source files (`./`, `../`) except barrel/index files.
- App code should not use `##/` or `~/`.
- Package code should not use `#/`, `##/`, or `~/`.
- Prefer package subpath imports over root imports for stable type targets.
  - Example: `@template/ui/components/layout/navigationTypes` instead of `@template/ui` for nav types.

## Folder Exports

- Prefer folder-based public APIs (`/lib`, `/hooks`, `/utils`, `/store`, `/test`).
- Keep root exports narrow; avoid dumping every symbol at package root.
- Keep `index.ts` files simple re-export barrels only.

## Frontend and Store Conventions

- Zustand slice composition is the standard pattern.
- Web/Admin include tenant context slice.
- Superadmin is user-context-first; avoid forcing tenant behavior unless explicitly required.
- Prefer existing permission checks with `permix` and existing guards.
- Navigation and context logic should use existing shared utilities before adding new ones.

## Auth and Permissions

- OAuth/provider credentials require two-way encryption/decryption (not hashing).
- Keep secrets encrypted at rest; never return secrets in API responses.
- Platform role `superadmin` is a bypass path in permission checks; enforce explicitly where needed.

## Types and API Safety

- Prefer `type` over `interface` unless merging is needed.
- Avoid `any`; use concrete types, unions, generics, or `unknown` with narrowing.
- Import canonical types from their source module; do not create duplicate alias wrappers.

## Testing and Validation

- Use `@template/db/test` factories (`build*` for in-memory, `create*` for persisted).
- Keep tests deterministic and async-safe.
- Run focused checks first:
  - `bun run --cwd <workspace> typecheck`
  - `bun run --cwd <workspace> test`
- If touching cross-package types/imports, run typecheck on each affected workspace.

## Change Checklist

1. Confirm existing pattern in nearby modules.
2. Implement minimal fix using existing utilities/types.
3. Keep imports aligned with alias rules.
4. Remove stale/duplicate logic and exports.
5. Run targeted typecheck/tests for changed workspaces.
6. Summarize exactly what changed and why.
