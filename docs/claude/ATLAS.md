# Atlas — the code map

<!-- toc:start -->

## Contents

- [What Atlas is](#what-atlas-is)
- [The concept vocabulary](#the-concept-vocabulary)
- [The `@atlas` annotation block](#the-atlas-annotation-block)
  - [`@kind` — the role](#kind--the-role)
  - [`@partOf` — membership](#partof--membership)
  - [`@uses` — load-bearing dependencies](#uses--load-bearing-dependencies)
  - [`@constructs` — factory output](#constructs--factory-output)
- [Navigating by concept](#navigating-by-concept)
  - [`bunx atlas graph --json`](#bunx-atlas-graph---json)
  - [`bunx atlas query`](#bunx-atlas-query)
  - [MAP.md](#mapmd)
- [Authoring annotations](#authoring-annotations)
  - [`bunx atlas stamp`](#bunx-atlas-stamp)
  - [Authoring rules](#authoring-rules)
- [The `.atlas/` config](#the-atlas-config)
- [Enforcement](#enforcement)
- [Cross-references](#cross-references)

<!-- toc:end -->

---

## What Atlas is

This repo is mapped by **atlas** (`@inixiative/atlas`): top-of-file `@atlas`
annotations + a repo-owned **concept registry** (`.atlas/`) + a generated
`MAP.md`. It is a Biome-shaped tool — a small CLI plus a `.atlas/` config folder
— and it lets you explore the codebase by **concept** instead of by crawling
folders. "Show me everything that touches caching" becomes one traversal.

Atlas only ever asserts what is **mechanically true** — what exists and how it
connects — never maturity or correctness. The map is a *projection of the code*:
each file declares what it is, what it's part of, and what it uses, so the map
cannot drift on structural facts.

The core discipline: **meaning emerges from the intersection of several true
edges**, not from one hyper-specific label. Keep the vocabulary broad but closed,
and apply it liberally. See also CLAUDE.md §11.5.

---

## The concept vocabulary

Concepts are named `class:name` and live in `.atlas/concepts.ts` (the
repo-owned registry — structure only, no status). The classes in this repo:

- **`feature:*`** — product capabilities (`feature:auth`, `feature:tenancy`,
  `feature:inquiry`, `feature:webhooks`, `feature:email`, …).
- **`primitive:*`** — reusable internal building blocks (`primitive:routeTemplates`,
  `primitive:appEvents`, `primitive:jobs`, `primitive:websockets`, `primitive:errors`,
  `primitive:requestContext`, `primitive:ui`, `primitive:shared`, `primitive:authz`, …).
- **`infrastructure:*`** — the platform substrate (`infrastructure:prisma`,
  `infrastructure:redis`, `infrastructure:storage`, `infrastructure:observability`,
  `infrastructure:env`).
- **`integration:*`** — the external-service boundary (`integration:stripe`,
  `integration:resend`).
- **`superadmin`** — a classless cross-cutting tag: the backend admin surface IS
  superadmin.

A concept entry also records its constituent `module`/`package` categories (which
fill `@partOf` during stamping) and its `docs:` references (existence-checked).
`@kind` values come from `.atlas/kinds.ts` (atlas's `DEFAULT_KINDS`, extendable).

---

## The `@atlas` annotation block

A top-of-file JSDoc block, above the imports (below a shebang if present). Every
axis is multi-valued (comma-separated on one line). `@atlas` opens the block.

```ts
/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, superadmin
 * @uses primitive:authz, infrastructure:redis
 */
```

| Question | Tag | Value | Notes |
|----------|-----|-------|-------|
| What is this? | `@kind` | closed enum (`kinds.ts`) | 1+, a role, not a layer |
| What is it part of? | `@partOf` | `class:name` concept(s) | membership; multi is normal |
| What does it use? | `@uses` | `class:name` concept(s) | dependency, load-bearing only |
| What does it build? | `@constructs` | factory output | constructors only |

### `@kind` — the role

`@kind` is a **ROLE, never a layer**. Use the file's role(s) from the vocab —
`controller`, `route`, `service`, `query`, `schema`, `middleware`, `handler`,
`client`, `registry`, `component`, `hook`, `page`, `type`, etc. A file can hold
several roles (`registry, type`). **Never** put `feature`/`primitive`/
`infrastructure` in `@kind` — those are concept *classes*, expressed via `@partOf`.

### `@partOf` — membership

`@partOf` is the concept(s) this file *composes* — remove it and the concept
breaks. Multiple is normal: a feature has many controllers/routes; a file can be
part of a feature *and* a cross-cutting tag (`feature:inquiry, superadmin`). The
reusable helpers that build a primitive belong to it (e.g. `makeController` is
`@partOf primitive:routeTemplates`).

### `@uses` — load-bearing dependencies

`@uses` is a dependency this file relies on but isn't part of — a concept whose
blast radius someone reasoning about would need this file for. **Load-bearing
only**, not every import. Skip incidental touches (one `db.x.update()` through the
request context is not "using" the database). Absence is meaningful, so atlas
never auto-stamps `@uses`:

- **no `@uses` line** = *uncurated* (nobody filled it in)
- **`@uses none`** = *curated-empty* (a human looked; nothing load-bearing)
- **`@uses? x`** = *proposed* (a patcher suggestion awaiting acceptance)

### `@constructs` — factory output

For constructor/factory files only — names what the factory builds.

---

## Navigating by concept

Prefer these over `grep` for "what touches X" / "what's part of Y" questions.

### `bunx atlas graph --json`

Reverse indexes built from the annotated tree:

```bash
bunx atlas graph --json
```

```ts
{
  conceptToFiles: Record<string, string[]>;   // via @partOf (membership)
  usesConsumers:  Record<string, string[]>;   // via @uses (consumers of a concept)
  fileToConcepts: Record<string, { partOf: string[]; uses: string[] }>;
  docToConcepts:  Record<string, string[]>;   // doc → concepts
}
```

So "everything that touches caching" is `usesConsumers['primitive:caching']` +
`conceptToFiles['primitive:caching']` in one call.

### `bunx atlas query`

Find files by axis. Takes flag predicates and/or a json-rules predicate (and
combines them with `all` when both are given):

```bash
# By flags (--kind / --partOf / --uses / --path)
bunx atlas query --kind controller --partOf feature:inquiry
bunx atlas query --uses infrastructure:redis

# By json-rules predicate (positional JSON)
bunx atlas query '{ "all": [{ "kind": "route" }, { "partOf": "superadmin" }] }'
```

Needs at least one of `--kind`/`--partOf`/`--uses`/`--path` and/or a JSON
predicate. Add `--json` for machine output.

### MAP.md

`MAP.md` (repo root, generated by `atlas generate` — do not edit by hand) is the
high-level concept map: each concept lists its docs, modules, files (bucketed by
`@kind`), and consumers. Read it for the high-altitude overview before opening
the tree.

---

## Authoring annotations

### `bunx atlas stamp`

`atlas stamp` writes/refreshes `@atlas` blocks from the rules — the
`eslint --fix` shape. **Dry-run by default**; pass `--write` to apply.

```bash
bunx atlas stamp <path>            # preview the block for a file/dir (dry-run)
bunx atlas stamp <path> --write    # apply
bunx atlas stamp --overwrite       # resync derivable axes to current rules
```

- **Additive (default):** fills only what's absent; never modifies an existing
  tag; **never** touches `@uses`.
- **Overwrite:** resyncs the derivable axes (`@kind`/`@partOf`) to the rules;
  still never overwrites curated `@uses`.

Stamp fills the derivable `@kind`/`@partOf` from `.atlas/config.ts`; you curate
`@uses` by hand. If a capture resolves to no concept, stamp leaves the file
without `@partOf` and surfaces the unresolved membership (add the concept to
`.atlas/concepts.ts`).

### Authoring rules

When you add or move a file, keep its `@atlas` block true:

- Validate names against `.atlas/`: `@kind` ∈ `kinds.ts`; `@partOf`/`@uses` must
  name a concept that exists in `concepts.ts`.
- Prefer several broad-true tags over one narrow tag — meaning emerges from the
  intersection of true edges.
- Write `@uses none` only after looking and confirming nothing load-bearing;
  otherwise omit the line (= uncurated).

---

## The `.atlas/` config

```
.atlas/
├── config.ts    # stamp rules (path → @kind / @partOf), include/ignore, reference resolvers
├── kinds.ts     # @kind vocabulary (extends atlas's DEFAULT_KINDS)
└── concepts.ts  # the concept registry — repo-OWNED, structure only
```

- **`config.ts`** — `include`/`ignore` globs (tests, `index.ts`, `generated/`,
  `*.gen.ts`, configs, scripts are ignored), plus `stamp` rules that map paths to
  `@kind` (structural globs) and `@partOf` (captures resolved via
  `partOfFor('module'|'package', '$1')` or explicit concepts). Rules compose;
  explicit wins. `references.docs` resolves a concept's `docs:` to
  `docs/claude/<v>` for existence checks.
- **`concepts.ts`** — the `CONCEPTS` registry: `class:name` → `{ module?,
  package?, docs? }`.
- **`kinds.ts`** — `KINDS = [...DEFAULT_KINDS]`; extend as needed.

---

## Enforcement

`bunx atlas check` is the CI primitive — it verifies annotations **exist and use
valid vocabulary** (block present, `@kind` in the vocab, `@partOf`/`@uses` name a
real concept, doc references resolve). It explicitly does **not** reconcile the
import graph or judge whether a `@partOf` is "really" true — existence, not
correctness. `bunx atlas coverage` reports unannotated files and the `@uses`
curation buckets.

---

## Cross-references

- `MAP.md` — the generated concept map (repo root)
- CLAUDE.md §11.5 — the agent-facing summary of this system
- The atlas README (`node_modules/@inixiative/atlas/README.md`) — full authoring guide
