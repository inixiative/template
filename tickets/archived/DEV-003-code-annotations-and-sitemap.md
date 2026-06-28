# DEV-003: atlas — code annotations + seam map (AI/human legibility)

**Status**: ✅ Done
**Assignee**: TBD
**Priority**: High
**Created**: 2026-06-09
**Updated**: 2026-06-11
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
repo is explorable by *concept* instead of by crawling folders, and a generated map makes that map
unable to drift on the **structural** facts (what exists, how it connects).

Seams are **bidirectional**: from a seam you get every file at it; from a file you get every seam
it sits on. "Show me everything that touches caching" becomes one traversal.

---

## The tool: `atlas`

DEV-003 ships as a **standalone, Biome-shaped tool** named **`atlas`**, in its own repo
(`git@github.com:inixiative/atlas.git`) — the map of the codebase. The template is consumer #1. The
name carries the whole thing: the package, the `@atlas` block tag, the `.atlas/` config folder, and
the `atlas` CLI binary.

The vocabulary + registry types (`kinds`, `concerns`, the seam registry shape, the `invert` export)
live in the **atlas repo**, not here — a consuming repo only keeps its own `.atlas/` config.

Two nouns, layered: **atlas** is the tool/map; **seams** are the nodes it charts (what `@partOf` /
`@uses` point at — `feature:x`, `primitive:y`, `infrastructure:z`).

### Install shape (like Biome / ESLint flat config)

A consuming repo gets a `.atlas/` folder:

```
.atlas/
  config.ts     // stamp rules (path → tags) + ignore/coverage rules
  kinds.ts      // @kind vocab — atlas ships a default, repo extends
  concerns.ts   // @concern vocab — atlas ships a default, repo extends
  seams.ts      // the seam registry — repo-OWNED (project-specific)
```

`atlas` ships sensible default `kinds` / `concerns` (near-universal across SaaS codebases). The
**seam registry is repo-owned** — it's the project's actual feature/primitive map; atlas only
validates `@partOf` / `@uses` names against it.

### CLI

```
bunx atlas graph      // reverse indexes: seam → files, file → seams, ticket → seams, doc → seams
bunx atlas check      // presence + vocab existence (the CI command)
bunx atlas coverage   // unannotated files; files missing @uses vs explicit-empty @uses
bunx atlas stamp      // write/refresh @atlas blocks from the config rules (the patcher)
bunx atlas generate   // → MAP.md from the annotated tree
```

---

## Design

### Annotations are structured comments, NOT TypeScript decorators

TS decorators only legally attach to classes/methods; this codebase is functional (route
templates, `makeController`, plain modules). Use a top-of-file JSDoc block comment — the `@`-tag
aesthetic with the mechanism of a comment: attaches to any file, zero runtime cost, parseable by
regex / comment-AST.

`@atlas` **opens the block** (the marker that says "this is an atlas block"), above the axis tags.
**One line per axis; comma-separated values within an axis** (the axes are the lines, the values
are a list — block stays compact; parse is `^\s*\*\s*@(\w+)\s+(.*)$` then `value.split(',')`):

```ts
/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, infrastructure:redis
 * @concern tenantIsolation
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

### Per-file tags (axes)

All axes are **multi-valued** (comma-separated list), uniformly — a file can play several roles,
belong to several seams, and the intersection is the meaning.

| Question | Tag | Value | Cardinality |
|----------|-----|-------|-------------|
| **What is this?** | `@kind` | enum role(s), closed set | 1+ (e.g. `entrypoint, registry`) |
| **What is it part of?** | `@partOf` | `class:name` seam(s) | 1 primary + secondaries; multi normal |
| **What does it use?** | `@uses` | `class:name` seam(s) it depends on but isn't part of | 0+ (load-bearing only) |
| **What cross-cutting properties?** | `@concern` | closed set (concerns.ts) | 0+ |
| **What does it build?** | `@constructs` | the thing a factory produces (constructors only) | 0+ |

**`class:name` style is required** for `@partOf`/`@uses` — the prefix *is* the seam's type, so the
generator groups by type for free and CI rejects unknown names against the registry. Examples:
`@partOf feature:email`, `@uses primitive:caching`, `@concern pii`.

**part-of vs uses is the membership/dependency distinction:** `ws/pubsub.ts` is **part-of**
`primitive:websockets` (remove it and websockets breaks) but **uses** `infrastructure:redis` (a
separate thing it calls). **Multi-`@partOf` is the bridge case** — the app-event email bridge is
`@partOf primitive:appEvents` *and* `@partOf feature:email`; that's a real seam, not dilution.

### `@kind` enum (closed set, ships in `kinds.ts`)

backend/shared: `controller` · `route` · `routeTemplate` · `middleware` · `handler` · `helper` ·
`service` · `schema` · `validator` · `transformer` · `integration` · `factory` · `constructor` ·
`registry` · `primitive` · `infrastructure` · `entrypoint` · `config` · `constant` · `type` ·
`seed` · `utils`
frontend: `component` · `page` · `hook` · `store`

(`handler` is never fused with its seam — a db mutation-lifecycle hook is
`@kind handler @partOf primitive:mutationLifecycle`; `hook` here = a React hook.)

- `entrypoint` is a kind, not a flag — "the way into a seam" (e.g. `ws/index.ts`).
- `constructor` is for factories (`makeController`, `makeJob`, route templates); pair with
  `@constructs` (`@kind constructor @constructs controller`). Distinct from a controller file.
- `constant` — a closed set of literal values / lookup table, no behavioral hook (`kinds.ts` /
  `concerns.ts` are exactly this). Distinct from `registry` (a config table that drives runtime
  behavior via an enforcing hook) and `config` (env / wiring).
- `type` — a pure type-only module (no runtime), distinct from a Zod `schema`.
- `utils` is the catch-all role for `lib/utils/*` and `packages/shared/utils` — also the canonical
  zone where path can't classify by domain, so these files carry explicit `@partOf`/`@uses`.

The vocabulary is **expected to keep growing** — adding a kind is a one-line registry edit. (Open
candidate: `environment` as a high-level axis/value — TBD.)

### The seam registry holds STRUCTURE ONLY — no status, no prose

The registry (`.atlas/seams.ts`) is the single source of valid seams. Each entry declares only
**mechanically-true** facts: where to read about the seam, and what code composes it. No `status`,
no `note`.

```ts
type SeamEntry = {
  // references — where to read about this seam (invertible: ticket → seams, doc → seams)
  docs?: string[];          // paths under docs/claude/
  tickets?: string[];       // ticket ids

  // constituents — the code that composes this seam; these FILL @partOf during stamping
  modules?: string[];       // internal module folders
  integrations?: string[];  // external-service folders (same as modules, other side of the boundary)
  packages?: string[];      // workspace packages, where a focused package IS the seam
};

'feature:tenancy': {
  docs: ['AUTH.md'],
  tickets: ['AUTH-002'],
  modules: ['organization', 'space', 'membership'],
},
```

- **`status` is gone — not declared, not derived.** It's the most rot-prone claim (the original
  cause of the scorecard's drift) and any proxy for "done" (do the tests pass? is it referenced?)
  is wrong as often as right. atlas asserts *what exists and how it connects*, never *maturity*.
- **`note` is gone** — free-text prose on the registry is a status-rot backdoor (the old notes
  `"subscribe authz pending"`, `"1/23 models"` were status claims in disguise). Anything worth
  saying lives in the seam's `doc` (a checkable path).
- **`ambient` is gone** — its only job was exempting ubiquitous infra from `@uses` *reconciliation*,
  and there is no reconciliation (see Enforcement). With nothing to exempt, it has no job.

**`modules` and `integrations` are the same mechanism on either side of the app's internal
boundary** — both are folders that produce routes/controllers/services/etc., both fill `@partOf`,
both resolve through membership lookup. They stay as two fields only to preserve the
internal/external distinction in the graph.

A module/integration **belongs to many seams routinely** — so membership is N→M and multi-`@partOf`
is the normal case, *not* a collision. The membership lists exist **purely to fill `@partOf`**.

### Inverting export (easy lookup)

From the forward declaration atlas derives the inverse for free — the bidirectionality the whole
thing is for. A generic `invert(field)` returns `Record<value, seamKey[]>`:

- `invert('modules')` / `invert('integrations')` → `module → seam[]` (drives `@partOf` stamping)
- `invert('tickets')` → `ticket → seam[]` ("what does FEAT-001 touch")
- `invert('docs')` → `doc → seam[]`

### Auto-stamp: glob rules with inline positional captures

`.atlas/config.ts` holds **stamp rules** (path → tags). Rules **compose** — every matching rule
contributes its axes to the file (one rule sets `@kind`, another sets `@partOf`); it is not
first-match-wins. Capture syntax carries intent:

- `*` — match one segment, **discard**
- `**` — match many segments, **discard**
- `$1`, `$2`, … — match one segment, **capture**, referenced in tag values

You number only what you capture, in order of appearance — so `**` is never a capture and the
multi-segment ambiguity disappears.

```ts
export default defineConfig({
  stamp: [
    { include: '**/controllers/**', kind: 'controller' },             // structural — @kind, no capture
    { include: '**/routes/**',      kind: 'route' },
    { include: ['apps/api/src/modules/$1/**'],
                                    partOf: partOfFor('module', '$1') },      // capture → membership lookup
    { include: ['apps/api/src/integrations/$1/**'],
                                    partOf: partOfFor('integration', '$1') }, // same mechanism, other side
  ],
  ignore: ['**/*.test.{ts,tsx}', '**/index.ts'],
})
```

- **`@kind`** is filled by simple structural globs.
- **`@partOf`** is filled by resolving a capture through the membership inverse (`$1` → seam(s));
  can yield multi-`@partOf`.
- **Explicit always wins** — auto-fill stamps the materialized value into the file; overload it by
  hand for exceptions, and the in-file value is authoritative.

### `@uses` is never auto-inserted

`@uses` is consumer-declared and load-bearing; it cannot be derived (imports churn as a file is
written). So atlas **leaves it out entirely** — and that makes absence meaningful:

- **no `@uses` line** = *uncurated* (nobody has filled it in yet)
- **explicit `@uses none`** = *curated-empty* (a human looked; it genuinely uses nothing load-bearing)

`coverage` reports those as two distinct buckets — a signal you lose the moment you auto-stamp
`@uses none` everywhere.

### Patching: `atlas stamp` (dry-run, targeting, additive / overwriting)

Blanks aren't permanent — they're fillable on demand. `atlas stamp` is the patcher: it materializes
`@atlas` blocks from the config rules, re-runnable whenever rules or the tree change (the
`eslint --fix` / codemod shape). Always preview first.

- **Targeting** — `all` (default), a folder, or a single file: `atlas stamp`,
  `atlas stamp apps/api/src/modules/billing`, `atlas stamp path/to/one.ts`. Optionally scoped by
  axis: `atlas stamp --uses src/jobs`.
- **`--dry-run`** — print the diff, write nothing. This is also the review surface: a proposal only
  becomes a real (curated) tag when a human/agent **accepts** the diff. An untouched file stays
  tagless — i.e. still *uncurated*, preserving the absence-as-signal invariant.
- **Additive mode (default, safe)** — fill only what's *absent*; never modify an existing tag. This
  is the only mode that touches `@uses`, and it touches it as *proposals*, not facts.
- **Overwriting mode (`--overwrite`)** — force-resync the **derivable** axes (`@kind`/`@partOf`) to
  the current rules, for when rules or membership changed and files drifted. Guardrails: it
  **never overwrites the curated axes** (`@uses`/`@concern`), and the dry-run diff is the safety —
  the human rejects any line that's an intentional overload. (Optional belt-and-suspenders: a pin
  marker on a tag exempts it from overwrite.)

Because `@uses` can't be derived mechanically without reintroducing ubiquity-noise, `atlas stamp
--uses` is really *import graph proposes → agent applies the load-bearing judgment → dry-run diff →
human accepts*. Per-folder targeting is what makes that agent pass tractable and reviewable instead
of one 850-file blob nobody trusts. `coverage` can surface three buckets: untouched / proposed
(e.g. a tentative `@uses?` marker) / curated.

### Enforcement: existence, NOT correctness

atlas checks that the annotations **exist and use valid vocabulary** — nothing that requires a
judgment call or a programmatic correctness proof:

- **presence** — every non-test/non-barrel file carries an `@atlas` block.
- **vocab existence** — `@kind` is in `kinds.ts`; `@partOf`/`@uses` names *exist* in the seam
  registry (does the seam exist — not, is the file really part of it).
- **reference existence** — a seam's `doc`/`ticket` paths exist.

Explicitly **out of scope**: import-graph reconciliation (declared `@uses` ⟺ real imports), any
"is this `@partOf` actually true" check, and any derived status. Those are fool's errands — they
trade a clear structural guarantee for a fragile proxy.

---

## Generator outputs

From one pass over annotated files + the seam registry:
1. **`MAP.md`** — the high-altitude entry point: grouped by seam (feature / primitive /
   infrastructure), each with its file list and kind breakdown. The "look at everything cheaply"
   index that defeats grab-bag.
2. **Reverse indexes** — seam→files, file→seams, ticket→seams, doc→seams; `@uses` consumer indexes
   (e.g. redis → [caching, websockets/pubsub, jobs, sessions, rate-limit]).
3. **Coverage report** — unannotated files, and files missing `@uses` vs explicit-empty.

---

## Rollout

- **Phase 1** — parser + seam registry + `@kind`/`@partOf` vocab + `MAP.md` generator + the `atlas`
  CLI skeleton.
- **Phase 2** — `atlas stamp` patcher (config-driven glob+capture; `--dry-run`, targeting,
  additive/overwriting); agent-assisted overload pass for exceptions (the 2026-06-09 scorecard was a
  manual prototype of this).
- **Phase 3** — `@uses` curation pass (`atlas stamp --uses`: import-graph proposals → agent judgment
  → accepted) + coverage buckets (untouched / proposed / curated).
- **Phase 4** — CI rule (presence + vocab existence) warn-only → enforcing.

~850 source files: **do not hand-annotate** — auto-stamp + agent backfill.

## Open

- **`environment`** as a worthwhile high-level tag/axis — TBD; vocab will keep growing.
- **`@constructs` vocabulary** — currently unvalidated (no `constructs.ts`); an earlier
  `@constructs appEventHandler` contradicts the decomposed `@kind handler`. Decide its value-space.
- **Node-noun** — keep "seam" vs cartography-align under the `atlas` metaphor.
- **`packages` scope** — only where a focused package *is* the seam, not kitchen-sink packages.
- **`type` vs `utils`/`constant`** boundary on real files.

## Decisions log

### 2026-06-11 (atlas convergence)

- **Name: `atlas`** — package + `@atlas` block tag + `.atlas/` folder + `atlas` CLI. Map-vs-territory
  framing; `atlas generate → MAP.md`. "seam" = the nodes the atlas charts (node-noun rename open).
- **Standalone Biome-shaped tool**; template is consumer #1. `.atlas/{config,kinds,concerns,seams}.ts`.
  atlas ships default `kinds`/`concerns`; the repo **owns `seams.ts`**.
- **CLI**: `atlas graph | check | coverage | generate`.
- **`@atlas`** opens each block, above the axis tags.
- **Registry is structure-only**: `docs[]`, `tickets[]`, `modules[]`, `integrations[]`, `packages[]`.
  **`status`, `note`, `ambient` all dropped** (status not even derived — fool's errand).
- **`docs`/`tickets` are plural**; **`modules`/`integrations` are the same mechanism either side of
  the app boundary**, N→M membership, **purely to fill `@partOf`** (multi-`@partOf` is normal, no
  collision check).
- **Inverting `invert(field)` export** → `Record<value, seamKey[]>` for free reverse lookup.
- **Auto-stamp = composing glob rules** with inline positional captures (`$1` captures, `*`/`**`
  discard). `@kind` from structural globs; `@partOf` from membership lookup; **explicit overload wins**.
- **`@uses` is never auto-inserted** — absence = uncurated, explicit `@uses none` = curated-empty;
  `coverage` distinguishes them.
- **Enforcement is existence + vocab-validity only** — presence, vocab exists in registry, doc/ticket
  paths exist. **No import reconciliation, no "is partOf true", no derived status.**
- **`@kind` additions**: `constant`, `type`.
- **Patcher (`atlas stamp`)**: dry-run + targeting (all / folder / individual / `--axis`). **Additive**
  (default; fill only absent; the only mode that touches `@uses`, as proposals) vs **overwriting**
  (`--overwrite`; force-resync derivable axes `@kind`/`@partOf` only — never the curated `@uses`/
  `@concern`; dry-run diff is the safety). Acceptance promotes a proposal to a curated tag, which
  preserves absence-as-signal. `@uses` fill = import-graph proposes → agent judges → human accepts.

### 2026-06-09/10 (foundation)

- Comments, not TS decorators (functional codebase). One line per axis; multiple values are a
  comma-separated list on that axis's line (`@partOf a, b, c`), never a repeated tag.
- **Token convention is uniform across every axis** (kind, partOf, uses, concern, constructs):
  value is **camelCase** (no kebab), seam class prefix is lowercase, `class:name` colon separator.
  e.g. `routeTemplate`, `primitive:mutationLifecycle`, `concern tenantIsolation`.
- Axes: `@kind` · `@partOf` · `@uses` · `@concern` (+ `@constructs` for factories). **All
  multi-valued** — `@kind` too (a file can be `entrypoint, registry`).
- `class:name` seam syntax; names validated against a typed seam registry.
- `entrypoint` and `utils` are `@kind` values.
- **`@uses` = load-bearing, NOT ubiquity.** Tag `@uses X` when X is integral to what the file
  *does* (part of its contract; someone reasoning about X's blast radius needs this file),
  regardless of how common X is. Don't *skip* a load-bearing dep because it's common
  (`json-rules`); don't *add* a tag for an incidental touch (a controller running one
  `db.x.update()` through the request context is not "using the database"). The discriminator is
  "is X shaping this file's behavior," never "is X widely used."
- Seam classes: `feature` · `primitive` · `infrastructure` · `registry` (the registry pattern is a
  first-class category — config table is `registry:x`, the hook enforcing it `@uses registry:x`).
- `infrastructure:postgres` (the DB, ambient) is distinct from `infrastructure:prisma` (deep ORM
  coupling — client/extensions/introspection — which IS tagged).
