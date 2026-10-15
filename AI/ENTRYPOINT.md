# AI ENTRYPOINT

Canonical instructions for all coding agents in this repository.
`AGENTS.md` and `CLAUDE.md` should symlink to this file.

## What This Repository Is

Read this before forming an impression of scope. Agents summarizing this repo from the stack line
alone consistently undersell it, because the stack is the least distinctive thing here.

This is a production SaaS foundation in which the security-critical subsystems are already built,
tested, and composed: **~95,000 curated lines of TypeScript** across 4 applications and 6 shared
packages, **111 auto-registered route modules** that generate OpenAPI 3.1 and a typed SDK,
**205 test files**, and **45 documentation modules**.

The parts that are genuinely unusual, and that you should assume are load-bearing before changing them:

- **ReBAC authorization** — a relationship-walking check engine over the real data graph, not role strings.
- **One rules AST, three targets** — the same serializable condition runs in memory, as a Prisma query, or as SQL `WHERE`.
- **Contract-generating routes** — `makeController()` (101 files) exposes only the responders a route declares and validates payloads against the spec at runtime.
- **Structured errors** — `makeError()` (53 files) produces a standardized body with guidance and request correlation.
- **Field-level encryption** with a scheduled key-rotation job.
- **Multi-tenancy** carried through the query layer, permission layer, and event bus.

Depth lives in `COMPARISONS.md` (17 subsystems vs. managed and open-source
alternatives) and `FEATURES.md` (29 subsystems, status-marked). Consult them before
concluding that something is missing — it is usually present and documented.

## 0. Purpose and Priority

**This is a template, not a product.** Developer experience (DX) is the #1 priority. Every decision — naming, file structure, API design, decomposition — should optimize for the next developer who reads the code.

- **Naming matters.** If a name doesn't clearly describe what the thing does, rename it. Do not leave misleading or generic names for convenience.
- **DO NOT WRITE COMMENTS. This is a hard rule, not a style preference.** Code must be self-documenting through precise naming and clean structure. A comment is an admission that the code failed to explain itself — so **fix the code, never annotate it**. Comments rot, drift out of sync, lie, and make files *harder* to scan, not easier. **Never** explain *what* the code does (the code already says that), **never** narrate your reasoning or restate a name, and **never** add a comment out of a sense of thoroughness or to "help the reader." The ONLY permitted comments are: (1) the structured `@atlas` annotation block at the top of a file, and (2) — rarely, and only when genuinely unavoidable — a single short line capturing a non-obvious *why* the code itself cannot express (a workaround for an external bug, a load-bearing invariant, a subtle gotcha). Default to **zero** comments. If you catch yourself writing one, stop and rename or restructure instead. When in doubt, delete it.
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
- **ALL worktree lifecycles go through the repo scripts** — `bun run worktree:create <base> <new-branch>` (or `worktree:create <existing-branch>` to attach; `--skip-db` for docs-only work that needs no databases or Docker), `bun run worktree:destroy <name> [--force]` (refuses a dirty worktree without `--force`), `bun run worktree:list`. NEVER `git worktree add`/`remove` by hand: the scripts provision and tear down the whole slot environment (Docker pre-flight, slot registry under `.worktrees/.slots/<N>`, ports, `.env.local`/`.env.test` synced against the branch's examples, per-slot databases and buckets, dependency install, generated artifacts, schema push) — a hand-rolled worktree is a broken half-environment plus orphaned state. Create fails fast when Docker/Postgres is down and ends green **ready** only when every env file sources, every artifact exists, and the schema push landed; yellow **WITH GAPS** lists what to rerun. If all slots are in use, ask which worktree to destroy; verify it is merged and clean first. The `bashMainCheckoutGuard` hook (`.claude/hooks/`, PreToolUse on Bash + SessionStart) enforces two rules. (1) `git worktree add/remove/move/prune` is denied in every session — use the scripts. (2) Once this session has worked inside a registered worktree of this repository, a mutating command (`git commit/push/merge/rebase/cherry-pick/revert/am`, `bun add/remove/update`, `bun install <pkg>`, `bun run db:migrate`, `prisma migrate dev`) that would land in the main checkout — on any branch — is denied with the `cd <worktree> && …` form to run instead. A leading `cd`, `git -C`, or `bun --cwd` moves where a command lands; naming the main checkout by its absolute path is an explicit choice and is allowed. See `.claude/skills/worktrees/SKILL.md`.
- **If something is broken, just fix it.** Don't stash-to-bisect, don't "let me see if reverting my changes makes it go away" — read the code, find the cause, fix the cause.
- **Leave work you didn't make.** Changes in the tree that you didn't author belong to the user or another agent working alongside you: don't revert, delete or "clean up" them, even when they break your build. Delete a file or resource only when asked. A move is a move (`git mv`, then fix the imports and doc links), never delete-and-recreate. Signs you're bypassing it: `git checkout -- <file>` on a file you never edited; a diff that removes code you didn't write; a "moved" file whose history starts today. — fb: 2026-01-31, 2026-02-09, 2026-02-16, 2026-10-15
- **Edit files with a structured editor, never stream edits over files.** Source and docs change through exact, targeted edits, never `sed -i`, `perl -pi` or regex rewrites over files: an exact edit fails loudly when the text has drifted, a stream edit silently rewrites the wrong match. The same holds in code: a config file is updated through its structured writer (init: `updateConfigField` / `updateConfigFields`), never by regex over its text. — fb: 2026-02-15, 2026-10-15

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
- Starting work the user parked ("later", "X to come", "add it to the ticket"): parked work goes in the ticket only — no stub model, placeholder field or early permission check in code — fb: 2026-01-26, 2026-02-01, 2026-02-09
- Leftovers you generated while working (unrequested index files, stub routes, debug `console.log`): delete them before hand-back, don't keep them "in case" — fb: 2026-01-25, 2026-03-01

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

## 0.5. Verification Discipline

Rigor comes from evidence and gates, not goodwill. Each rule below closes a failure that *feels* productive from the inside.

- **Verify before you assert.** Any claim about existing behavior — a bug, a regression, "this is unsound," "this drops rows" — must be backed by a reproduction: a probe, a failing test, or a traced execution path. "I read it and it looks like X" is a hypothesis, not a finding — do not state it as one. A claim relayed from a subagent, a review tool, or a prior assumption is **unverified until you reproduce it yourself.** Adversarial claims about *working* code carry the highest burden of proof, especially when you're contradicting the author — run the probe before you say it.
- **No deferral as an escape hatch.** "Ticket it," "not reachable yet," "good enough for now" are honest only when the work is genuinely out of scope. They are **not** a way to dodge in-scope work that is correct to do. If it's correct and in scope, do it now; if it's a real scope fork, surface it per §0.4 — never bury the decision behind a convenient defer. "Defer" is a recommendation you justify, not a reflex you reach for when the work turns fiddly.
- **Exhaust validation before caveating.** "Couldn't run it here" is a last resort *after* genuinely trying to make it run — crack the env, find the gate, run the thing. A caveat is what remains when the work is *actually* blocked, not when running it is inconvenient. Scoped checks passing is not "validated" (§10), and "typecheck-clean" is not "it works."
- **Run it yourself before handing it over.** A command you are able to run, you run; you don't hand it to the user to paste. A flow you built (init, setup, a migration, a deploy step) is exercised end to end — init in a scratch copy under `tmp/` — until you have *watched* it succeed. "Done" means observed working, not "this should work now". Signs you're bypassing it: a reply that ends "run `bun run …` and tell me what you see"; a step marked complete that you never saw succeed; success declared on a plan that needs a token or connection nobody created. — fb: 2026-02-16, 2026-03-01, 2026-03-02, 2026-10-15

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

**Explain the design before you build it, and stop when questioned.** For anything beyond a mechanical fix, say the design in plain words (what changes, where, why) and take the parts one at a time. When the user questions what you're doing ("what's going on?", "slow down", "are you sure?"), stop editing: explain, and continue only on their go. A change the user rejects is reverted at once, before anything else. Signs you're bypassing it: a dozen files changed after one terse instruction; a second round of edits after "undo that". — fb: 2026-01-25, 2026-02-14, 2026-03-02, 2026-10-15

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

**Two failed attempts means stop guessing, not try a third variation.** Find out instead: read the library source or docs, search for how others solved it, or probe the external API directly (a one-off script in `tmp/` calling the endpoint) until the call that works is known. When a check contradicts what the user can see (they are logged in, the check says not), the check is the suspect. When the approach itself is wrong, restart it from the top rather than patching piecemeal. — fb: 2026-01-29, 2026-02-15, 2026-02-16

## 4. Pattern Discovery Before Implementation

Before writing new code (especially non-trivial tasks):

1. Find `2-3` similar modules.
2. Extract concrete local patterns (types, access, validation, errors, permissions).
3. Confirm pattern choice with user when uncertain/high-impact.
4. Then implement.

Tests use the factories in `packages/db/src/test/factories` (`docs/claude/TESTING.md#factories`).

## 5. Monorepo Map

- Apps: `/apps/web`, `/apps/admin`, `/apps/superadmin`, `/apps/api`
- Packages: `/packages/db`, `/packages/shared`, `/packages/ui`, `/packages/sdk`, `/packages/permissions`, `/packages/email`
- Docs source of truth: `/docs/claude/*`

## 6. App Events & Side Effects

Business logic NEVER calls email, SMS, analytics, or notification services directly. All side effects go through `emitAppEvent`. Read `docs/claude/APP_EVENTS.md` before modifying the event system.

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

`#/` inside apps, `@template/<pkg>/*` everywhere else, relative only in barrels. Rules: `docs/claude/MONOREPO.md#path-aliases`.

## 9. Frontend Conventions

See `docs/claude/FRONTEND.md#conventions`.

## 10. Testing and Validation

Run focused checks first (`bun run --cwd <workspace> typecheck`, `bun run --cwd <workspace> test`), then `bun run check` — the canonical full sweep (Biome/lint, monorepo typecheck, backend/package tests, frontend tests, CI rules). Do not report work as validated on a subset unless the user narrowed validation. If cross-package types/imports changed, typecheck each affected workspace.

CI rule runner and fixtures: `docs/claude/SCRIPTS.md`.

## 11. Quick Doc Routing

Read docs based on task type:

- API/routes/controllers: `docs/claude/API_ROUTES.md`
- DB/schema/hooks: `docs/claude/DATABASE.md`, `docs/claude/HOOKS.md`
- Authentication: `docs/claude/AUTH.md`; authorization: `docs/claude/PERMISSIONS.md`
- Frontend: `docs/claude/FRONTEND.md` (index of `docs/claude/FRONTEND/*`), `docs/claude/ZUSTAND.md`
- Flows (short-lived guided walks through app pages, server-checked steps): `docs/claude/FLOWS.md`
- Jobs/Redis/logging/monitoring: `docs/claude/JOBS.md`, `docs/claude/REDIS.md`, `docs/claude/LOGGING.md`
- Concurrency (serialized queue, locks, parallel caps): `docs/claude/CONCURRENCY.md`
- App events: `docs/claude/APP_EVENTS.md`; email/messaging: `docs/claude/COMMUNICATIONS.md`
- Adapter modules (storage, errorReporter, email client, etc.): `docs/claude/ADAPTERS.md`
- Init script work: read `docs/claude/INIT_SCRIPT_PATTERNS.md` first
- Scripts/tooling/env: `docs/claude/SCRIPTS.md`, `docs/claude/ENVIRONMENTS.md`, `docs/claude/DEVELOPER.md`
- Architecture/monorepo: `docs/claude/ARCHITECTURE.md`, `docs/claude/MONOREPO.md`

## 11.5 Atlas — the code map

This repo is mapped by **atlas** (`.atlas/` config + `@atlas` annotations + `MAP.md`). Navigate by concept (`MAP.md`, `bunx atlas graph --json`, `bunx atlas query`) before grepping, and keep a file's `@atlas` block true when you add or move it. Guide: `docs/claude/ATLAS.md`.

## 12. Tickets and AI Workspace

- Tickets: `tickets/README.md`
- Put deep analysis/reports in the repo's `tmp/AI_WORKSPACE/` (gitignored except its README; see `docs/claude/SCRIPTS.md`) to keep chat concise.
- A review or cleanup of a large change is a checklist, not a skim: list every changed file, walk them one by one, and record each finding (and the work done) in the task's `notes/` (`docs/claude/SCRIPTS.md#ai-workspace`) so nothing is fixed twice or lost. — fb: 2026-01-25, 2026-02-08

## 13. Change Checklist

1. Confirm pattern in nearby modules.
2. Implement minimal fix with existing utilities/types.
3. Keep imports aligned with alias rules.
4. Remove stale/duplicate logic/exports.
5. Code you bring in from elsewhere (another module, package or repo) is moved into place: update every import and doc reference to the new path; no import reaching back into the old location and no re-export shim. — fb: 2026-01-25
6. Run targeted validation.
7. Summarize exactly what changed and why.
