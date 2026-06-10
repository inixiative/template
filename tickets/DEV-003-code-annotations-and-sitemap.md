# DEV-003: Code Annotations + Seam Map (AI/human legibility)

**Status**: 🏗️ In Progress
**Assignee**: TBD
**Priority**: High
**Created**: 2026-06-09
**Updated**: 2026-06-09
**Related**: FEAT-014 (AI Developer Experience); the 2026-06-09 FEATURES.md scorecard

---

## Problem

The map (FEATURES.md, tickets, docs) drifts from the territory (code) because it's
hand-maintained prose with no mechanical link to what it describes. A 2026-06-09 audit of
FEATURES.md against code found **6 outright contradictions** ("Permify" → actually Permix; webhook
"HMAC-SHA256 / shared secret" → actually RSA-SHA256 asymmetric; "100% factory coverage" → 20/23;
"19 models" → 23; "93 tests" → 172; audit "pending" → shipped) plus 11 detail caveats.

The consequence is identical for AI agents and humans: the surface can't be trusted, so
understanding the repo means reading ~60k lines, so everyone satisfices and leaves — agents
grab-bag a few files and answer from stale labels; people bounce off in the first session. This is
a **legibility + trust** failure, not a quality failure.

## Goal

Every file declares **traversable seams** — what it is, what it's part of, what it uses — so the
repo is explorable by *concept* instead of by crawling folders, and a generated map plus a CI rule
make that map physically unable to drift from the code.

Seams are **bidirectional**: from a seam you get every file at it; from a file you get every seam
it sits on. "Show me everything that touches caching" becomes one traversal, exhaustively.

---

## Design

### Annotations are structured comments, NOT TypeScript decorators

TS decorators only legally attach to classes/methods; this codebase is functional (route
templates, `makeController`, plain modules). Use a top-of-file JSDoc block comment — the `@`-tag
aesthetic with the mechanism of a comment: attaches to any file, zero runtime cost, parseable by
regex / comment-AST.

**One tag per line** (clean diffs — adding a `@uses` is a one-line add; line-oriented parse
`^\s*\*\s*@(\w+)\s+(.*)$`):

```ts
/**
 * @kind controller
 * @partOf feature:organizations
 * @uses infrastructure:redis
 */
import { ... }
```

### Capturing meaning via convergence (the core philosophy)

The goal is to **capture meaning**, and meaning emerges from the **intersection of several true
edges**, not from one hyper-specific label. Keep the vocabulary **broad but closed**; apply it
**liberally**. "The thing that redacts user PII for retention" is not a bespoke tag — it's
`@kind handler` ∩ `@partOf feature:users` ∩ `@concern pii` ∩ `@concern retention` converging.
**Prefer multiple broad-true tags over one narrow tag** — it builds a denser, more queryable graph.

Discipline that keeps convergence from becoming noise: every edge must still be **true and
load-bearing**. Multiplicity is in how many tags *genuinely apply*, not in lowering the bar per
tag. Most files will carry **multiple `@partOf` and/or `@uses`**, and that's expected.

### Per-file tags (four axes)

| Question | Tag | Value | Cardinality |
|----------|-----|-------|-------------|
| **What is this?** | `@kind` | enum role (closed set) | 1 |
| **What is it part of?** | `@partOf` | `class:name` seam (registry) | 1 primary + secondaries; multi is normal |
| **What does it use?** | `@uses` | `class:name` seam it depends on but isn't part of | 0..n (load-bearing only) |
| **What cross-cutting properties?** | `@concern` | closed set (concerns.ts) | 0..n |
| **What does it build?** | `@constructs` | the thing a factory produces (constructors only) | 0..n |

**`class:name` style is required** for `@partOf`/`@uses` — the prefix *is* the seam's type, so the
generator groups by type for free and CI rejects typo'd/unknown names against the registry. Same
discipline as `Modules.x`. Examples: `@partOf feature:email`, `@uses primitive:caching`,
`@concern pii`.

**part-of vs uses is the membership/dependency distinction:** `ws/pubsub.ts` is **part-of**
`primitive:websockets` (remove it and websockets breaks) but **uses** `infrastructure:redis` (a
separate thing it calls). **Multi-`@partOf` is the bridge case** — the app-event email bridge is
`@partOf primitive:app-events` *and* `@partOf feature:email`; that's a real seam, not dilution.

### `@kind` enum (closed set, lives in the registry)

`controller` · `route` · `route-template` · `middleware` · `hook` · `job` · `app-event-handler` ·
`service` · `schema` · `validation` · `integration` · `factory` · `constructor` · `primitive` ·
`infrastructure` · `utils` · `entrypoint` · `config` · `seed`

- `entrypoint` is a kind, not a flag — "the way into a seam" (e.g. `ws/index.ts`).
- `constructor` is for factories (`makeController`, `makeJob`, route templates); pair with
  `@constructs` (`@kind constructor @constructs controller`). Distinct from a controller file,
  which is `@kind controller`.
- `utils` is the catch-all role for `lib/utils/*` and `packages/shared/utils` — also the canonical
  zone where path can't classify by domain, so these files carry explicit `@partOf`/`@uses`.

### Status / doc / ticket live on the SEAM, not the file

Decided: **`@status`, `doc`, and `ticket` are properties of the feature/primitive, not of any
file.** A complete feature has in-flight files; a half-built one has finished files — per-file
status is noise that rots fastest, and per-file doc/ticket links go stale exactly like the
FEATURES claims did. They move up to the **seam registry**, one entry per seam:

```ts
// seams.registry.ts (single source of valid seams + their metadata)
{
  'feature:email':          { status: 'partial',  ticket: 'COMM-001', doc: 'COMMUNICATIONS.md' },
  'primitive:websockets':   { status: 'partial',  ticket: 'INFRA-004', doc: 'APP_EVENTS.md' },
  'infrastructure:redis':   { status: 'complete', doc: 'REDIS.md' },
  ...
}
```

The registry is the **single source of valid seams** — `@partOf`/`@uses` names are validated
against it (typo'd `feature:emial` fails CI), and it's where status/doc/ticket are cross-checked
against FEATURES.md and tickets. Same anti-drift move as `Modules`.

### Enforcement: enforce presence, auto-fill the derivable class, overload to override

**Enforce** that every non-test, non-barrel file carries a valid annotation block. The objection
"don't make people hand-type the 85% case" is answered by **auto-fill, not by exempting them**:

1. **Auto-fill** — a codemod/generator stamps `@kind` + `@partOf` from path convention for the
   derivable file classes (routes, schemas, controllers, services, integrations, hooks, jobs,
   middleware…). Nobody hand-types the common case; the block is *materialized into the file*.
2. **Overload** — when a file is an exception (feature ≠ its folder; a factory in `lib/`), edit the
   stamped value. **Explicit always wins.** A `makeController` in `lib/utils/` is stamped
   `@kind utils` by path, then overloaded to `@kind constructor @constructs controller`.
3. **CI** = presence + schema-valid against the registry. One trivial rule, because ground truth is
   *in the file* (not split between path-inference and annotations that could disagree). Derivation
   is only the default fill; the materialized value is authoritative, so path and annotation can
   never conflict — the explicit value is simply the answer.

Why enforce-and-fill beats derive-don't-declare: the seam is **visible in the file** an agent is
reading (not hidden in generator logic it must know exists), overrides are uniform (edit the value,
no exception lists), and the CI check is presence+schema rather than re-deriving path rules to know
whether a missing tag is allowed.

### `@uses` — the one genuinely open decision

`@uses` is consumer-declared and **reconciled against the import graph**: a declared `@uses` must
correspond to a real (transitive) import of that seam's code, and a real import of a registered
infrastructure/primitive seam must have a matching `@uses`. That two-way check against the
territory is the completeness guarantee that makes "show me everything that touches caching"
exhaustive.

Open: on a freshly-stamped file, imports churn as it's written, so `@uses` can't be reliably
auto-filled. Two options:
- **(A, leaning)** `@kind`/`@partOf` are enforced-present; `@uses` is governed *only* by the
  import-graph reconciliation rule (CI flags a missing/stale `@uses`), so you never type
  `@uses none` boilerplate.
- **(B)** `@uses` enforced-present-but-may-be-empty (`@uses none`).

Also open: enforce `@uses` for **all** seam classes, or only `infrastructure:`/`primitive:`?
Feature→feature `@uses` risks noise. Leaning: mandatory `@uses` for infrastructure + primitives,
optional for feature→feature.

---

## Generator outputs

From one pass over annotated files + the seam registry:
1. **`MAP.md`** — the high-altitude entry point: grouped by seam (feature / primitive /
   infrastructure), each with its file list, kind breakdown, status. The "look at everything
   cheaply" index that defeats grab-bag.
2. **Reverse indexes** — seam→files and file→seams; `@uses` consumer indexes (e.g. redis →
   [caching, websockets/pubsub, jobs, sessions, rate-limit]).
3. **Generated/verified FEATURES.md** — prose downstream of the registry + annotations, never
   hand-maintained against the code.
4. **Coverage report** — unannotated files (drives coverage → 100%, then CI enforces presence).

## CI rules (`scripts/ci/rules/`)

- **presence**: every non-test/non-barrel file has a valid annotation block.
- **schema**: `@kind` in the enum; `@partOf`/`@uses` names exist in the seam registry.
- **`@uses` reconciliation**: declared uses ⟺ real imports (both directions, scoped to
  infra/primitive seams).
- **seam honesty**: a registry `status: complete` seam → its files' co-located tests pass;
  `doc`/`ticket` paths exist; a FEATURES.md claim with no backing seam fails (orphan claim).

This is what prevents the scorecard's 6 contradictions from ever recurring — the map can't lie,
because CI checks it against the territory on every PR.

---

## Rollout

- **Phase 1** — parser + seam registry + `@kind`/`@partOf` schema + `MAP.md` generator.
- **Phase 2** — auto-fill codemod for the derivable file classes; agent-assisted overload pass for
  exceptions (the scorecard was a manual prototype of this).
- **Phase 3** — `@uses` + import-graph reconciliation.
- **Phase 4** — generated/verified FEATURES.md; CI rules warn-only → enforcing.

~850 source files: **do not hand-annotate** — auto-fill + agent backfill.

## Why this is in scope even before adoption polish

Making the repo legible to AI is the same work as making "primitive is beyond reproach" a
*measurable* claim — you can't certify a primitive complete if the map lies about what's done. The
annotation + honesty rule turns the manual scorecard into an automatic, always-green guarantee.

## Decisions log (this thread)

- Comments, not TS decorators (functional codebase). One tag per line; repeated tags (multiple
  `@uses`, primary + secondary `@partOf`) each get their own line.
- Three core questions: `@kind` (what is this) · `@partOf` (part of what) · `@uses` (uses what);
  `@constructs` for factories.
- `class:name` seam syntax; names validated against a typed seam registry.
- Status/doc/ticket live on the **seam**, not the file.
- `entrypoint` and `utils` are `@kind` values.
- Enforce presence on all non-test/non-barrel files; **auto-fill by path-derivable class, overload
  to override, explicit wins.**
- **`@uses` = load-bearing, NOT ubiquity — RESOLVED.** Tag `@uses X` when X is integral to what
  the file *does* (part of its contract; someone reasoning about X's blast radius needs this file),
  regardless of how common X is. Two failure modes to avoid:
  - don't *skip* a load-bearing dep because it's common — `json-rules` is everywhere but is tagged
    wherever a file is built on it; `find.ts`/user-hydration is `@uses primitive:caching` because
    it's literally a cache wrapper (warms sibling caches too).
  - don't *add* a tag for an incidental touch — a controller running one `db.x.update()` through
    the request context is not "using the database"; its job is the mutation, not the DB.
  So `infrastructure:postgres` is mostly untagged because the context-query path is *incidental*
  (not because it's common); files genuinely coupled to the ORM (client, mutation-lifecycle
  extension) tag `infrastructure:prisma`. The discriminator is "is X shaping this file's behavior,"
  never "is X widely used."
- Seam classes: `feature` · `primitive` · `infrastructure` · `registry` (the registry pattern is a
  first-class category — config table is `registry:x`, the hook enforcing it `@uses registry:x`).
- `infrastructure:postgres` (the DB, ambient) is distinct from `infrastructure:prisma` (deep ORM
  coupling — client/extensions/introspection — which IS tagged).
- `@kind` additions: `registry`, `component` (frontend), `transformer`; `validation`→`validator`.
- **Still open:** `@uses` presence-vs-reconciliation on freshly-stamped files (leaning
  reconciliation-only, no `@uses none` boilerplate).
