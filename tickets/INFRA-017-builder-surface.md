# INFRA-017: Builder Surface — Exposed Surface + Projection + describeRule

**Status**: 🚧 In Progress (exposedSurface + describeRule shipped & published; sourceValues-folding projection landed in 2.10.0; ref-id serializable lens form still deferred to INFRA-016)
**Assignee**: Aron
**Priority**: High
**Created**: 2026-06-13
**Updated**: 2026-06-27

---

_Updated 2026-06-27: json-rules **2.8.0 published** (was "awaiting npm publish") — `exposedSurface` + `describeRule` are live on npm. Subsequent releases extended this surface: **2.9.0** added per-field eligibility (`sources?: Record<field, Condition>` on the narrowing) + `sourceQueries(lens)` (DISTINCT compiler, Prisma + SQL, SQL degrading to `null` on array-condition predicates); **2.10.0** taught `exposedSurface(lens, { sourceValues })` and `projectByPath(lens, { sourceValues })` to fold fetched option lists into the projection (per-model union / per-path exact) under a canonical `SourceValues = { path, mapName, model, field, values }` and a serializable `{ lens, sourceValues }` wire shape. The serializable **projection surface** (Objectives, last `[ ]`) is therefore partly delivered — sourceValues riding the projection is in — but the **ref-id serializable lens form** (`parent`-as-id + registry resolution) is still deferred to INFRA-016 and unbuilt. Template installs `^2.10.0`._

## Overview

The rules builder consumes a schema surface derived from a lens, not a
hand-written schema. The server→client handoff is **two artifacts**, and the
hard rule is: **never ship the raw, un-narrowed lens** — that leaks every field
the narrowing was meant to hide.

Two shapes come out of a lens, and they are different things (keep them distinct
in naming everywhere):

- **Lens** — maps intact, the navigable model→field→model graph.
- **Projection** — `projectByPath`'s path-keyed view; the graph is flattened away.

1. **`global` — the total exposed surface, *as a Lens*.** Every model/field/enum
   value visible on *at least one* reachable, narrowed path. ✅ **Done
   (leak-safe)** — `exposedSurface(lensOrNarrowing)` in json-rules
   (`src/lens/exposedSurface.ts`): applies root at the anchor, path-specific
   narrowing along declared paths, `mapDefaults` elsewhere, unioned per model;
   drops `where`; emits a registry of exposed values only. Returns a **Lens**
   (maps intact). Leak-invariant tests cover root-omit-at-anchor (hidden),
   union-via-cycle (exposed), enum-registry-narrowing.
2. **The narrowed lens itself** — the traversal-encoded narrowing that constrains
   what's allowed at each path. `projectByPath` is the per-path **Projection**,
   but it returns a `Map` and **includes `where` clauses** — needs a
   serializable, **where-stripped** form for the browser (where = server scope,
   applied via `applyLens` at execution, never sent to the client).
3. **describeRule** — static analysis of a finished rule against a lens:
   which sources it touches, which bridges it crosses, which targets
   (`check`/`toPrisma`/`toSql`) remain valid. ✅ Shipped in json-rules 2.8.

Roles, kept distinct: `exposedSurface`/projection = *what to show*;
`checkRuleAgainstLens` = *the gate*; `describeRule` = *source/target classification*.

## Objectives

- ✅ `exposedSurface` — reachable, fully-narrowed, cycle-safe Lens (leak-safe
  client surface; `where`-stripped; union per model)
- ✅ `describeRule(condition, lens)` → `{ sources, bridgesCrossed, supportedTargets, violations }`
  (shipped in 2.8 with `exposedSurface`)
- [ ] Serializable lens for persistence/handoff = the **ref-id form** (`parent` as
  a lens id resolved from a registry; bridges already ref maps by name). The lens
  is **already serializable in object form** (`JSON.stringify` works; `where` is a
  `Condition` — part of the DSL — and stays). This is INFRA-016. `where`-stripping
  is NOT a serialization step; only the client-facing `exposedSurface` strips it.

## Tasks

- [ ] Ref-id lens form (INFRA-016): `parent`-as-id + registry resolution; the
      object form already serializes. **No `where`-strip here** — `where` is DSL.
      Stripping `where` + physical details (`dbName`, `fromFields`/`toFields`,
      `relationName`, bridge `on`) is the *client-surface* concern (`exposedSurface`),
      separate from serialization — keep them distinct.
- [ ] `describeRule`: walk the rule (like checkRuleAgainstLens), intersect
      per-operator catalog targets with bridge-crossing (bridge ⇒ check-only)
- [ ] Decide how the exposed surface + projection are bundled for the builder
- [ ] Tests: source/target classification, bridge-crossing rule ⇒ check-only

## Implementation Notes

- **Done so far**: `exposedSurface` — leak-safe total exposed surface as a Lens
  (see Overview). Cycle-safe (declared-path visits keyed by path, off-path by
  model). 11 tests in `test/lens.exposedSurface.test.ts` incl. the leak
  invariants. **Not yet committed with a version bump (targeting 2.8).**
- `describeRule` is the source-awareness primitive feature flags / email / the
  builder all need — bridge-crossing rules are `check()`-only after hydration via
  `buildBridgeDictionary`.
- **Email consumer surface (COMM-001).** For email the lens roots are
  `{ sender, recipient, data }`, narrowed per actor-context (space → space+org →
  org → platform) and per template/event type; `exposedSurface` ships it
  where-stripped to the builder, `where` is re-applied server-side at send. The
  email render runtime (`packages/email/render/*`) already consumes the builder's
  outputs (`Condition` JSON via `evaluateConditions`, `{{recipient.x}}` via
  `interpolate`), so the surface only has to describe those three roots.
- Leak invariant to test on every surface artifact: no field/enum value present
  that is omitted on every reachable path; no `where` clause present.
- `exposedSurface` strips `where` because the client never executes — and the
  server is the sole executor, so there's no off-server handoff to preserve `where`
  for. (The old `seal` idea was dropped for that reason — see INFRA-016.)

## Definition of Done

- [x] `exposedSurface` shipped with tests
- [x] `describeRule` shipped with tests
- [x] 2.8.0 cut (version + CHANGELOG + README + LENS docs), committed & pushed
      (cda7460); **published to npm 2026-06-27** (2.8.0 → 2.9.0 → 2.10.0 all live)
- [~] Serializable projection surface — `sourceValues`-folding projection + wire
      shape `{ lens, sourceValues }` shipped in 2.10.0; ref-id lens form still
      deferred to INFRA-016

## Related Tickets

- **Depends on**: INFRA-016 (serialization model)
- **Feeds**: INFRA-002 (rules builder), INFRA-018 (lens builder)
