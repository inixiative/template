# INFRA-002: Rules Builder (Separate Repo)

**Status**: 🚧 In Progress (headless core done; React layer next)
**Assignee**: Aron
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-06-13

---

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
- [ ] UI-decoration layer over the pure tree: stable ids for React keys
      (`stripMeta` before serialize, `trimEmptyGroups`, `switchGroupOperator`
      AND↔OR toggle) — keep `core/tree.ts` pure `Condition`; ids live in a parallel
      decorated layer. (Pattern proven in Zealot PR 1022 `treeOps.ts`.)
- [ ] `useRuleBuilder` hook wrapping the tree engine + surface + validation/describe.
      **Editor boundary contract:** the persisted/DB Condition is CLEAN (no
      `_id`/`_groupId`). The hook `withIds` on load (in), keeps the decorated tree
      only for React rendering, and `onChange`/`getValue()` always return
      `stripMeta(trimEmptyGroups(...))` (out). Decorated form never escapes the
      editor; validation/describe/preview/persist all run on the clean form.
- [ ] Recursive component hierarchy mirroring Zealot PR 1022:
      `RuleBuilder` → `RuleGroup` (recursive AND/OR, depth cap) → `RuleRow`,
      with `GroupHeader`/`GroupFooter`, and a `SchemaContext` carrying the surface.
- [ ] **Out-of-the-box shadcn slot implementation** of all the builder pieces
      (the example set the slot contracts are designed for).
- [ ] **Storybook** showcasing each slot/component and state in isolation.
- [ ] **Example app** with the shadcn components factored into a separate
      module and consumed by the app (TanStack Start or Vite — TBD).
- [ ] Slot contract test suite (`testing/`); preview panel (run `check()` on
      sample data; hydration spec for bridge-crossing rules).

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
