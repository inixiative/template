# INFRA-002: Rules Builder (Separate Repo)

**Status**: 🚧 In Progress (pivoted to pure-headless descriptor tree in 0.2.0; shadcn drop-in renderer + one-call `resolve` in 0.3.0; Ladle + check()-preview panel + standalone FieldSelector still open. Built locally, NOT published)
**Assignee**: Aron
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-06-27

---

_Updated 2026-06-27: rules-builder built **0.2.0 + 0.3.0** (local working tree, **not published**). **0.2.0 — pure-headless pivot:** `useRuleBuilder` now returns a **descriptor tree** (`GroupNode`/`LeafNode` = which controls exist + bound actions), and the entire slot system this ticket described — `ComponentSlots`/`RuleBuilder`/`RuleGroup`/`RuleRow`/`builder/slots.ts`/`context.ts`/`GroupHeader`/`GroupFooter` — was **deleted** (so the "recursive components / slot contracts" `[x]` tasks below are now superseded by the descriptor model, not regressed). Added `lensValuePicker`/`useLensValuePicker` (pick any value/path in a lens — the shared field+path atom, i.e. the FieldSelector substrate) and a plain reference renderer. **0.3.0:** `composeSurface` → one-call `resolve(source, { sourceValues })`; `decorateSources` deleted (folded into the projection); a real **shadcn-style drop-in renderer + Tailwind** added in the example app. **Still open:** Ladle stories, the check()-on-sample **preview panel**, and extracting a standalone `FieldSelector` (the descriptor + `lensValuePicker` cover the substrate, but the packaged component isn't cut). The shadcn slot item below is now satisfied by the 0.3.0 renderer._

## Overview

Visual rule builder for `@inixiative/json-rules`, in the **`rules-builder`** repo
(home for all builders: this, the lens builder, and the source-map importer).
Lets users compose a json-rules `Condition` without writing JSON. Used by feature
flags, email rules, notification rules, and permission rules.

The existing `rules-builder` contents are a stale type-only skeleton from the
old PLAN.md (predates Lens v2.2) and may be deleted wholesale — it hand-rolls a
`FieldType`/operator registry that json-rules now ships natively and better.

## Architecture (revised 2026-06-13)

- **Schema comes from a lens, not a hand-written config.** The builder consumes
  the *builder surface* (INFRA-017): the **exposed surface** — a Lens (maps
  intact, the navigable graph) from `exposedSurface()` — plus the path-keyed
  **projection** for per-path divergence. Relation drill-down (User → Org →
  members → …) navigates the Lens graph, so cycles are natural, not
  depth-bounded.
- **Operators come from json-rules' catalog** (`FIELD_OPERATOR_CATALOG`,
  `getOperatorsForKind`, `ValueShape`, target-aware) — including 2.6/2.7
  additions (`within`/date expressions via `acceptsExpr`, windowing via
  `WINDOW_SELECTOR`, and the pre-window `filter`). Do not re-implement.
- **Source-aware**: `describeRule` (INFRA-017) classifies a finished rule by
  source/bridges-crossed/valid-targets; bridge-crossing rules are `check()`-only.
- **Components by interface, not bundled.** Accept components satisfying a typed
  slot contract + ship an example set (shadcn), rather than shipping UI. (Keep
  the existing `builder/slots.ts` contracts.)

## Key Components

- Headless `useRuleBuilder` core: condition-tree state, path-addressed mutations
  (add/remove/update, wrap/unwrap all/any, if/then/else), visit-aware nesting
- Value-vs-field-reference toggle (`value` vs `path`)
- Live validation via `validateRule({ target })` + whole-rule source/target badge
- Slot contracts for value inputs (incl. `range`, `dayList`, `count`,
  relative-date, field-path picker grouped by source)
- Preview panel running `check()` against sample data; hydration spec for
  bridge-crossing rules

## Tasks

- [x] Delete stale skeleton; rebuild on the lens surface
- [x] Schema layer = `describeModelFields()` over an exposedSurface lens + catalog
      operators + label decoration (`schema/surface.ts`)
- [x] Condition-tree engine — pure path-addressed mutations (`core/tree.ts`)
- [x] Slot contracts (`builder/slots.ts`)
- [x] UI-decoration layer (`core/decorate.ts`): `withIds` (stable React keys),
      `switchGroupOperator` (AND↔OR), `trimEmptyGroups`, generic `stripMeta`
      (strips any `_`-prefixed key, artifact-agnostic). Plus tree-engine
      `groupSiblings` (group N siblings down a layer) + dissolve-`unwrapCompound`.
- [x] `useRuleBuilder` hook — composes the surface from serializable maps
      (parent-less narrowing), holds decorated state, enforces the editor boundary
      (clean in/out), exposes mutations + fields()/describe()/validate().
- [x] Recursive components (slot-injected): `RuleBuilder` → `RuleGroup` (recursive
      AND/OR, depth cap) → `RuleRow`, + `GroupHeader`/`GroupFooter` + context.
      RuleRow picks the value slot by `ValueShape`.
- [x] **Example app** (Vite) with a factored-out slot set (`examples/`); verified
      via `vite build`. DOM test harness (happy-dom + @testing-library/react, React
      19); 42 tests incl. a render→add-rule→clean-condition integration test.
- [x] **Out-of-the-box shadcn slot implementation** — shadcn-style drop-in
      renderer + Tailwind shipped in the 0.3.0 example app (`examples/shadcn/`,
      `examples/RuleTreeShadcn.tsx`).
- [ ] **Ladle** stories showcasing each slot/component + state (matches template
      `packages/ui`, which uses Ladle — template PR 5).
- [ ] **Extract a generic `FieldSelector`** — the field-path picker half of
      `RuleRow`, standalone + slot-injected, with relation drill-down (delivers the
      drill-down the rule builder itself also needs). Reused as the email
      interpolation injector (COMM-001) and by filter UIs (FE-003).
- [ ] Slot contract test suite (`testing/`); preview panel (run `check()` on
      sample data; hydration spec for bridge-crossing rules); relation drill-down
      (array operators / nested-model field resolution — v1 is anchor-model fields).

### Reference: Zealot PR 1022 (`userevidence/Zealot-Monorepo`)

Prior RuleBuilder for segment conditions. Confirms our direction and informs it:
component hierarchy above; immutable path-based `treeOps`; stable `_groupId`/
`meta._id` keys + `stripMeta`/`trimEmptyGroups`; a per-source condition **registry**
of field configs; and a schema hydration that **embeds options directly on
fields** (replacing an earlier `{ schema, runtime }` split) — which is exactly
what `exposedSurface` does by inlining narrowed enum `.values`. Don't replicate
its API-specific serialization (`conditionTree.ts`); our AST is json-rules native.

Done so far is committed & pushed to the rules-builder repo (typechecked, 20
tests). The React layer needs `react` installed + a DOM test harness, ideally
after json-rules 2.8 is published so the dep resolves from the registry (a local
symlink is in use for dev).

## Use Cases

Feature flag targeting, email automation, notification rules, permission
conditions, approval workflows.

**Email is the first real consumer (COMM-001).** Its render runtime already
exists (`packages/email/render/*`): `evaluateConditions` runs json-rules `check`
on `{{#if rule=<Condition>}}` blocks, and `interpolate` substitutes
`{{recipient.x}}` tokens. So the builder here is purely an *authoring* front-end —
it must emit that exact `Condition` JSON and those tokens, over a lens narrowed to
`{ sender, recipient, data }` per actor-context. This makes the **FieldSelector**
(see Tasks) load-bearing, not optional: it is the variable/interpolation injector.

## Critical path (revised after review)

The near-term goal is unblocking COMM-001 / FEAT-008 / FEAT-003, which author
rules over a **single Prisma source** — no bridges, non-Prisma sources, or
lens-builder UI required. The real path is short:

`prisma-map` (exists) → **INFRA-017** (builder surface) → **INFRA-002** (this).

A lens for a known use case can be hand-authored or generated server-side, so
INFRA-018 (lens builder UI) is a convenience, **not a blocker**. INFRA-013/014/015
(non-Prisma sources, bridge registry) are the multi-source vision and are **not**
on this critical path.

## Related Tickets

- **Blocked by**: INFRA-017 (builder surface) — the only hard dependency
- **Benefits from** (not blocking): INFRA-016 (persistence), INFRA-018 (lens builder)
- **Blocks**: COMM-001 (Email system), FEAT-008 (Permissions builder),
  FEAT-003 (Feature flags)
