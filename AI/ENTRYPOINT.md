# AI ENTRYPOINT

Canonical instructions for all coding agents in this repository.
`AGENTS.md` and `CLAUDE.md` should symlink to this file.

## 0. Purpose and Priority

**This is a template, not a product.** Developer experience (DX) is the #1 priority. Every decision — naming, file structure, API design, decomposition — should optimize for the next developer who reads the code.

- **Naming matters.** If a name doesn't clearly describe what the thing does, rename it. Do not leave misleading or generic names for convenience.
- **One file, one concern.** Each file should have a single clear purpose. If a file has multiple exported functions that serve different consumers, split them. The cost of an extra file is near zero; the cost of hunting through a multi-purpose file is real.
- **YAGNI applies to scope invention, not to completion.** See section 0.3 for the precise rule.
- **No continuous support debt.** Build things that are self-explanatory and do not require hand-holding. If a consumer needs to read the source code to understand the API, the API is wrong.
- **Adversarial reviews should run regularly.** After any significant implementation, run an adversarial review in the background against the full scope of changes. Do not wait for the user to ask. Flag issues proactively.

## 0.0 Critical Guardrails

- Do not bypass failures by editing CI rules/fixtures.
- Protected paths: `scripts/ci/rules/**`, `scripts/ci/run-ci-rules.sh`, `scripts/ci/rule-violations/**`.
- If a rule fails, fix the violating source code.
- Only change CI rules/fixtures when the user explicitly requests it.
- Prefer minimal, targeted changes over redesigns.
- Do not run git commands unless the user explicitly asks.
- **NEVER run `git stash` — for any reason, ever.** Not for "baseline verification", not for "let me test if this is from my change", not for "let me try and see". If you need to compare against HEAD or a clean state: use `git show HEAD:<path>` to read a file at HEAD, `git diff` to see changes, or read the file content directly. Stash has destroyed in-flight work before.
- **NEVER use `git -c <key>=<value>` to bypass any rule** — this includes (but is not limited to) bypassing the stash ban, signing requirements, hook execution (`--no-verify`), or any other guardrail. If a command requires bypassing config, stop and ask.
- **If something is broken, just fix it.** Don't stash-to-bisect, don't "let me see if reverting my changes makes it go away" — read the code, find the cause, fix the cause.

## 0.1. Understand the Why First

Before touching the *how* of anything non-trivial, hold the **why** — what the thing is *for*, the problem it exists to solve. Purpose is the frame that makes every downstream choice legible; without it you optimize in the dark.

This is not throat-clearing. Working a mechanism without holding its purpose produces **category errors that feel like progress**: you strip the wrong thing, "simplify" away the load-bearing part, call a dead snapshot "already fine," conflate two concerns because at the mechanism level they rhyme. Each looks locally reasonable and is wrong because it serves no real goal. Correctness is relative to intent — the purpose is the only thing that tells you whether a mechanism choice is *right*.

- **Ask "what is this for?" before "how does it work?"** If you can't state the purpose in a sentence, you're not ready to change the code. Find it — in the user's words, the docs, the consumers, the commit that introduced it — or ask.
- **A hint about intent is the highest-value input there is.** When the user tells you what something is for, that reframes everything; treat it as ground truth and re-derive from it — don't paste it on top of your mechanism-level model.
- **Re-anchor after long stretches of mechanism.** Plumbing pulls you down to the token level. Surface periodically and re-ask: does this still serve the why? Repeated "are you sure?" pushback means you've lost the frame — stop and recover the purpose before continuing.
- **Everything downstream depends on it.** A primitive's boundaries, what's load-bearing vs incidental, how to decompose it (§0.2) — all fall out of what it's for.

## 0.2. Decomposition by Default

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

## 0.3. YAGNI — Scope Invention vs. Completion

**The error runs BOTH directions — be vigilant for both.** Overbuilding (scope invention) and underbuilding (trimming real completion) are equal failure modes, and both feel virtuous from the inside: trimming feels *disciplined*, adding feels *thorough*. Neither is the safe default. The danger in both is the **silent** call — quietly adding coupling the author didn't want, or quietly deleting a thing the author wanted. Watch yourself in both directions, not just the one that's salient.

**Overbuild (scope invention).** Adding things adjacent to the task that nobody asked for. Symptoms:

- Extra fields on a model "in case we need them later"
- Wrapper functions around single-call sites
- Defensive try/catch around code that can't throw meaningfully
- Backwards-compat shims for unused old paths
- A second helper file for one current caller + "future" callers
- Re-exports / barrels that nothing imports
- Comments explaining what well-named code already says

**Underbuild (trimming real completion).** When the work IS "build primitive X," all the features that make X actually usable are in scope. Symptoms of *wrongly* trimming:

- Shipping a v1 that forces a v2 in a week (binary support, version-awareness, config flexibility)
- Hardcoding what should be parameterized (CLI flag, regex)
- Stuffing a thing in one consumer when it belongs as a shared primitive
- Skipping the API that makes the thing testable / setup-able (static cache, global setup)
- Deferring a primitive/seam/foundation the codebase deliberately builds ahead of its first consumer

**Discriminator:** "is this in service of what was asked, or adjacent to it?" Clear in-service → build. Clearly adjacent noise (dead barrel, redundant comment) → skip. **A genuine judgment call in EITHER direction → flag and ask, don't decide silently** (per §0.4): name it, say which way it leans and why, and ask build-now / defer / drop. Don't silently add on a guess of "thorough," and don't silently trim on a guess of "needed."

**Tiebreaker when unsure:** is the thing a foundation (in `packages/shared` or template-level infra)? Lean build-it-complete. Is it feature code? Lean trim. Either way, if it's a real judgment call, surface it — don't bury the add *or* the trim.

## 0.4. Interrogate Before Proposing (Discovery Work)

For anything where the **shape is not yet known** — design, taxonomy, modeling, naming, architecture — the shape is discovered by **interrogation, not assertion**. Lead with questions; hold the confident synthesis until the shape has been interrogated.

- **Interrogate before you propose.** Open the design space before closing it. Ask what you'd need to know; surface the forks. Questions are the deliverable here, not a failure to deliver — a premature closed proposal forecloses the discovery.
- **At a fork, ASK — do not assume.** When more than one defensible shape exists and the choice depends on intent you don't have, stop and ask. Do not pick the option your prior pattern-matches to and present it as the answer.
- **Name your assumptions and mark confidence.** Distinguish *recommendation* from *low-confidence guess*. Tag the soft calls so they're easy to spot and challenge — for you as much as for the reader.
- **Prefer options with tradeoffs over a single recommendation** when the shape is unsettled. Breadth first, commitment later.
- **Small piece → validate → extend.** Propose one concrete sample, get it validated, then widen. Caps the blast radius of any wrong assumption to one batch.
- **If you catch yourself assuming, stop.** To assume is to make an *ass* of *u* and *me*. Beware especially of applying a good heuristic (e.g. "keep taxonomies minimal") as a *conclusion* before you've confirmed it fits the actual goal.

This does **not** override section 1's bias to act on clear, in-scope requests. It applies when the work is genuinely shape-finding, not execution.

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
- Permissions/auth: `docs/claude/PERMISSIONS.md`, `docs/claude/AUTH.md`
- Frontend/state/tables: `docs/claude/FRONTEND.md`, `docs/claude/ZUSTAND.md`
- Jobs/Redis/logging: `docs/claude/JOBS.md`, `docs/claude/REDIS.md`, `docs/claude/LOGGING.md`
- Concurrency (serialized queue, locks, parallel caps): `docs/claude/CONCURRENCY.md`
- App events/email/notifications: `docs/claude/APP_EVENTS.md`
- Adapter modules (storage, errorReporter, email client, etc.): `docs/claude/ADAPTERS.md`
- Init script work: read `docs/claude/INIT_SCRIPT_PATTERNS.md` first
- Scripts/tooling/env: `docs/claude/SCRIPTS.md`, `docs/claude/ENVIRONMENTS.md`, `docs/claude/DEVELOPER.md`
- Architecture/monorepo: `docs/claude/ARCHITECTURE.md`, `docs/claude/MONOREPO.md`

## 11.5 Atlas — the code map

This repo is mapped by **atlas** (`.atlas/` config + `@atlas` annotations + `MAP.md`).

**To navigate by concept instead of crawling folders:**
- Read `MAP.md` for the high-level concept map (features / primitives / infrastructure, each with its files + role breakdown).
- Run `bunx atlas graph --json` for reverse indexes (concept → files, concept → consumers) and `bunx atlas query --kind controller --partOf feature:inquiry` (or a json-rules predicate) to find files by axis.
- A file's top-of-file `@atlas` block tells you its role + memberships + dependencies before you open it.
- Prefer these over `grep` for "what touches X" / "what's part of Y".

**When you add or move a file, keep its `@atlas` block true:**
- `@kind` = the file's ROLE (controller/service/query/schema/handler/client/type/component/hook/page/…), never a layer.
- `@partOf` = the concept(s) it composes (`feature:*` / `primitive:*` / `infrastructure:*`, or the `superadmin` tag). Multiple is normal.
- `@uses` = load-bearing dependencies only (the concepts this file's behavior is built on), or `@uses none` if truly none. Not every import.
- `bunx atlas stamp <path>` fills the derivable `@kind`/`@partOf` from the rules; you curate `@uses` by hand. Validate names exist in `.atlas/concepts.ts`. See the atlas README for the full authoring guide.

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
