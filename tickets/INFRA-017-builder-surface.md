# INFRA-017: Builder Surface — Exposed Surface + Projection + describeRule

**Status**: 🚧 In Progress
**Assignee**: Aron
**Priority**: High
**Created**: 2026-06-13
**Updated**: 2026-06-13

---

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
- [ ] Serializable, where-stripped projection surface for the browser (only needed
  when the builder requires path-specific divergence; deferred until then)

## Tasks

- [ ] Serializable projection: JSON shape, strip `where`, **strip physical
      details** (`dbName`, `fromFields`/`toFields`, `relationName`, bridge `on`),
      cycle handling consistent with `exposedSurface`. (`exposedSurface` returns a
      full in-memory `Lens`; the stripping happens at the serialization boundary.)
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
- `exposedSurface` strips `where` because the client never executes. The
  server→subtenant handoff (which preserves `where` + per-path narrowing) is
  `seal` — see INFRA-016. Do not conflate them.

## Definition of Done

- [x] `exposedSurface` shipped with tests
- [x] `describeRule` shipped with tests
- [x] 2.8.0 cut (version + CHANGELOG + README + LENS docs), committed & pushed
      (cda7460); awaiting `npm publish`
- [ ] Serializable projection surface shipped (deferred — see Objectives)

## Related Tickets

- **Depends on**: INFRA-016 (serialization model + `seal`)
- **Feeds**: INFRA-002 (rules builder), INFRA-018 (lens builder)
