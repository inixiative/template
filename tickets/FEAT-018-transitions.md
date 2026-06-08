# FEAT-018: `@inixiative/transitions` — declarative transition guard + affordance layer

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-06-08
**Updated**: 2026-06-08

---

## Overview

A small, **stateless** primitive on top of `@inixiative/json-rules` that answers two
questions about an entity's lifecycle, declaratively:

- **"Can this change happen?"** — guard a proposed update.
- **"What changes can happen?"** — list available transitions for a record (and, via
  `toPrisma`, every record currently eligible for a transition).

It is **not** a state machine (no statecharts/actors/hierarchy), does **not** own state,
and does **not** execute the change or run side effects (that stays in the hooks pipeline).
It is a guard + affordance layer. Depends on json-rules; does **not** live inside it
(json-rules = predicates + `toPrisma`; transitions = before/after + merge + registry).

The unlock: a transition is **pure data** → serializable → **tenant-configurable at runtime**
(stored in the DB, edited in a UI, no deploy to change a lifecycle).

## Shape

```ts
type Side = {
  predicate: Condition;   // json-rules
  requires?: Include;     // Prisma-include-shaped; relations the predicate reads (metadata)
};

type Merge =
  | ((record, changes) => next)              // code callers: full power, NOT serializable
  | MergeStrategy;                           // serializable keyword (see below)

type Transition = {
  from: Side;                                // evaluated against the CURRENT record
  to:   Side & { merge?: Merge };            // evaluated against the RESULTING record
  permission?: ActionRule;                   // edge-specific authz; ANDed with the action's permission
};
```

- `from`/`to` share a shape; the asymmetry (current vs resulting record) is load-bearing —
  make it loud in types/docs.
- `merge` lives on `to` (it produces the resulting state). Default `spread`.

### Merge strategies (Mongo-flavored, serializable)
Hybrid: a raw callback is allowed for code callers; serialized/customer configs must use a
keyword strategy. Provide an `isSerializable(transition)` check so callers know whether a
given transition can be persisted/tenant-configured.

- `spread` (≈ `$set`, default) — shallow overwrite
- `deepMerge` (≈ `$merge`)
- `{ kind: 'append', path }` (≈ `$push`) — array concat (field-scoped → needs a path)
- `{ kind: 'appendUnique', path }` (≈ `$addToSet`) — concat + dedupe

> Gotcha: array strategies are **field-scoped** — `{ kind, path }`, not a bare keyword.

## Kernel (pure, ORM-agnostic, ~tiny)

```ts
check(t, record, changes) =>
  t.from.predicate(record) && t.to.predicate(applyMerge(t.to.merge, record, changes))
  → { ok: boolean; reason?: 'no-from' | 'no-to' }
```

Return a **reason**, not a bare bool, so callers can surface "can't reach `connected` from
`disconnected`".

## Duality (why it earns a package)

Every `from.predicate` is also a query:
- **point**: `check(t, record, changes)` — guard one change.
- **set**: `toPrisma(t.from.predicate)` → a `where` for *all* records eligible for `t`,
  e.g. `prisma.inquiry.findMany({ where: toPrisma(resolve.from.predicate) })`.

## Registry + Actions (the affordance layer)

A `Transition` is atomic (one `from→to→merge`). An **action** is a named group of
transitions — its *paths* — so one logical verb can be valid via several edges
(`a→b` OR `c→d`) without losing that they're one action. Disjunction lives at the
action level, never inside a `Transition` (keeps the kernel atomic + serializable).

```
type Action = {
  paths: Transition[];      // OR of edges; single-path action = array of one
  permission?: ActionRule;  // @monorepo/permissions rebac rule (serializable); see Verified notes
  label?: string;           // affordance UI
};
Map<model, Record<actionName, Action>>
```
An action is an **object**, not a bare `Transition[]`: actions are the unit of authorization
(per-action, state-independent) and affordance (label/icon), and a bare array has nowhere to
hang those — both are already on the roadmap, so the object isn't speculative.
- `available(model, record, { actor, authorize })` → action names with **any** path whose
  `from.predicate(record)` is true **and** `authorize(action.permission, record, actor)` passes
  → drives action-button enablement, API affordances, "what can I do".
- `check(model, action, record, changes)` → **first** path whose `from` matches the current
  record AND `to` matches the merged next-state (that path's `merge` applies).
- `eligible(model, action)` → `toPrisma(Any[...paths.map(p => p.from.predicate)])` — one OR'd
  `where` for bulk "who can take this action" (verified: `toPrisma(Any) → { OR: [...] }`).

## Serializable → tenant-configurable

Because predicates (json-rules), `requires` (include shape), and keyword merge strategies are
all JSON, a transition set can be stored per-tenant and edited without a deploy. This turns a
code primitive into a configuration surface. Requirements that fall out of this:

- **Authoring validation** (mirror json-rules' existing **lens validation** — read its impl,
  don't invent a parallel API): on save, validate predicate fields/types exist, `requires` is
  a valid include, `merge` is a known strategy.
- **Field/relation allowlist per model** — a customer predicate compiles via `toPrisma` to a
  real `where` (customer-controlled DB query) and `requires` to real loads. Without scoping,
  that's a data-exposure / access-control hole. The configurable surface must constrain which
  fields/relations a tenant may reference.
- **Relation loads respect permissions/tenancy** (see relations layer below).

## Lens-awareness / composition (scoped)

Make transitions lens-aware so **composition** can be checked — but scope it:
- **Cheap (do this):** structural / lens alignment — does A's `to` lens line up with B's
  `from` lens; mirror json-rules' lens validation.
- **Expensive (do NOT promise):** reachability / "do these predicates ever co-satisfy" is
  predicate **satisfiability** — SAT-hard for arbitrary conditions. No solver.

## Relations (`requires`) — designed, NOT built yet

Kernel ignores `requires` (it's metadata). A **separate optional loader** later derives the
Prisma `include` from `requires`, auto-loads before eval, fails loud if a predicate reads an
unloaded relation (vs silently `undefined`), and **respects permissions/tenancy**. The kernel
must never import Prisma. Build only when the first relation-referencing transition appears.

## Scope

- **Now:** kernel + merge (cb + keyword strategies + `isSerializable`) + registry +
  `available()` + `toPrisma` set-query + authoring validation + field allowlist.
- **Later (design in README, unbuilt):** `requires`/relation-loader, permission-filtered
  `available()`, lens composition checks beyond structural.
- **Non-goals:** statecharts, side effects / on-transition callbacks, a workflow engine, a
  config UI. Core stays a pure evaluator over data.

## Tasks

- [ ] Package skeleton `@inixiative/transitions`, depends on `@inixiative/json-rules`
- [ ] Kernel `check()` (from/to predicate eval + merge application) returning `{ ok, reason }`
- [ ] Merge: raw cb + keyword strategies (`spread`, `deepMerge`, `append`, `appendUnique`) +
      `isSerializable(transition)`
- [ ] Registry: `Map<model, transitions>`, `available(model, record)`, `eligible(model, name)`
- [ ] `toPrisma` set-query helper off `from.predicate`
- [ ] Authoring validator (mirror json-rules lens validation) + per-model field/relation allowlist
- [ ] Lens-aware structural composition check (no SAT solver)
- [ ] Tests: kernel (from/to asymmetry), merge strategies, serializability check, registry
      `available()`, validator rejections, `toPrisma` round-trip
- [ ] README: the relations/`requires` loader design (unbuilt), non-goals, the Evans line
- [ ] Adopt for first consumers (see below)

## Consumers (template-first)

Ships as the base primitive any status-bearing model adopts. Reference adopter in template:
- **Inquiry status** lifecycle (`available()` powers the inquiry action surface).

Downstream apps adopt it for their own lifecycles (e.g. tribe: Bot status, ChatMessage
`pending → sent → failed`). Pairs with typing status as a discriminated union (compile-time);
this is the runtime half.

## Verified integration notes
_Source-checked 2026-06-08 against `@inixiative/json-rules@2.5.0` + `@monorepo/permissions`._

- **Permissions (rebac) is serializable + json-rules-native.** `ActionRule` (Zod, recursive):
  `string | null | { rel, action } | { self } | { rule } | { any: [] } | { all: [] }`, where the
  `{ rule }` leaf is a json-rules `Condition` (`check(rule.rule, record)`). So a transition's
  `action.permission` *is* an `ActionRule` — same serializable algebra as the from/to predicates.
  Inject `rebac.check(permix, schema, model, record, action.permission)` as the `authorize`
  callback. **Don't depend on / move permissions** — that dependency points the wrong way
  (generic primitive → app authz); injection keeps transitions zero-app-dep. Permission rules
  already live in the schema **and per-row** (`record.permissionRules`), so transition authz is
  tenant/row-configurable for free.
- **Lens is field-scope, NOT authz.** `LensNarrowing` is purely structural (`parent`,
  `root: ModelNarrowing`, `mapDefaults`; `EnumNarrowing.picks`) — no actor/context field. Use it
  for the referenceable-field allowlist (derive a narrowed lens per context) and
  `checkRuleAgainstLens` for **authoring validation** (already exists — don't reinvent). Two
  orthogonal axes: field-scope → lens; actor-authz → injected `rebac.check`.
- **`toPrisma` compiles booleans** (verified in impl): `Any → { OR: [...] }` (empty →
  match-nothing), `All → { AND: [...] }`. So `eligible(action) = toPrisma(Any[...froms])` yields
  one OR'd `where`.

- **Field-scope = reuse `@monorepo/db/lens`, don't build.** `lensFor(model)` is the base lens;
  `redactLens(lens)` narrows out redacted fields (from `HOOK_REDACT_FIELDS`); the read route
  already composes `projectByPath(redactLens(filterLens))` for its filter surface. So a
  transition's field allowlist + authoring validation = `checkRuleAgainstLens(predicate,
  redactLens(lensFor(model)) [+ context narrowings])`. No new field-security layer.
- **Registry mirrors `RebacSchema`.** Both are `Record<model, Record<actionName, …>>` over the
  same models on the same json-rules substrate — transitions is "the rebac schema for state
  changes." Keep shapes parallel; reuse the per-row override pattern (`record.permissionRules` ↔
  a per-row transitions override).
- **"action" is overloaded** — permission-action (authz capability: `read`, `own`) vs
  transition-action (state op: `connect`, `forcePair`). They compose (a transition's `permission`
  may name a permission-action), but keep the two registries conceptually distinct in docs.
- **⚠️ Prerequisite — the per-request context-narrowing cb lives in ZEALOT and is NOT ported.**
  The contextual lens form — `filterLens: (c) => LensNarrowing` (Hono ctx → narrowing, e.g. scope
  to the actor's tenant/role) — exists in zealot, but template only has the **static**
  `filterLens: LensNarrowing` (`appEnv.ts`, `prepareMiddleware.ts`, `routeTemplates/types.ts`).
  **Verified in zealot** (`apps/api/src/middleware/resources/scopeNarrowing.ts`): a
  `scopeNarrowing(scope)` middleware where `scope: (c: Context<AppEnv>) => WhereScope | Promise<WhereScope>`
  reads the route's static `filterLens`, then `mergeNarrowingWheres(current, await scope(c))` folds a
  per-request context where-narrowing into it. The narrowing *mechanism* (chains, `root.where`,
  `redactLens`) is in template; the **un-ported pieces are `scopeNarrowing` +
  `mergeNarrowingWheres` + the `Scope = (c) => WhereScope` route field** (zealot:
  `apps/api/src/middleware/resources/{scopeNarrowing,mergeNarrowingWheres}.ts`,
  `apps/api/src/lib/requestTemplates/types.ts`). Port those first for per-actor field/where-scoping
  of transition predicates.

## Worked example: validation → transition

Authz is **intrinsic** to a valid transition — one with no passing permission isn't valid; the
effective check ANDs every permission that applies. Absent = open; use deliberately.

**Permission placement — UNDECIDED, two options:**
- **Option A — action-level + target-split.** One permission per action; express target-keyed authz
  (roles) by splitting verbs by target — `promoteToOwner` with `from: { role: in [member, admin] }`,
  `to: { role: owner }`, `permission: 'grantOwner'` — plus an optional per-path override
  (`Transition.permission`) for genuinely multi-path verbs. _Pro:_ explicit, self-contained, distinct
  `available()` affordances; target-keyed authz becomes plain action authz. _Con:_ more named verbs.
- **Option B — per-side permission.** Add `from.permission` / `to.permission` (authz factored by
  state exit/entry) — e.g. one `changeRole` action with `to.permission` on each role state. _Pro:_
  DRY when many unrelated verbs share a state-entry/exit authz. _Con:_ extra knob; effective authz
  spans levels; less readable. _(Alt to B:_ evaluate `authorize` against the merged/next record so an
  action-rule can reference the target directly — fewer knobs, pushes target logic into rule conditionals.)
- Both compose with an action-level baseline. **Decide at build.** Leaning A for clarity; B earns its
  keep only for big shared state-entry policies (locked/archived-style).

Big payoff: a class of imperative validation collapses into from/to predicates.

**"Can't remove the last org owner."** Imperative today = a service checks "is this the last
owner?" and throws. As a transition on `organizationUser`:

```
removeOwner = {
  permission: 'manage',                              // rebac action: who may manage members
  paths: [{
    from: {
      predicate: All[
        { field: 'role', op: equals, value: 'owner' },                   // currently an owner
        <aggregate: organization.organizationUsers where role=owner → count > 1>  // another owner remains
      ],
      requires: { organization: { organizationUsers: true } },           // load siblings for the aggregate
    },
    to: { predicate: { field: 'role', op: notEquals, value: 'owner' } }, // result: no longer owner
  }],
};
```

`available(record)` won't offer `removeOwner` to the last owner (its `from` aggregate fails);
`check()` rejects it. The "last owner?" guard disappears into a declarative `from`. (Aggregate via
json-rules `AggregateRule` / `AGGREGATE_OPERATORS` — exact syntax TBD at build.)

**Inquiry (status lifecycle).** Maps almost 1:1; the per-type resolution *effects* stay in handlers
(gate, don't do):

```
approve = { permission: 'resolve',                 paths: [{ from: { status: pending }, to: { status: approved } }] }
reject  = { permission: 'resolve',                 paths: [{ from: { status: pending }, to: { status: rejected  } }] }
cancel  = { permission: { self: 'sourceUserId' },  paths: [{ from: { status: pending }, to: { status: cancelled } }] }
```

`available(inquiry)` → which of approve/reject/cancel to show (status=pending + actor); the existing
per-type `RESOLUTION_EFFECTS` + sent/resolved appEvents fire after, unchanged. So transitions owns
the inquiry *gate + affordance*; the inquiry handlers keep the *do*.

**Subsumes:** preconditions on current state, target-state shape, cardinality / "last-of-kind"
(aggregates over `requires`'d relations). **Does NOT replace:** cross-entity side effects,
multi-step sagas — anything that must *do*, not *gate*.

## Relevant files & references

- **json-rules** (`@inixiative/json-rules@2.5.0`): `check`, `toPrisma` (`Any→{OR}`, `All→{AND}`),
  `Any`/`All`, `applyLens`, `checkRuleAgainstLens`, `createLens`, `Lens`/`LensNarrowing`, `projectByPath`.
- **permissions**: `packages/permissions/src/rebac/{types,check,schema,permissionRulesSchema,ownerActions}.ts`.
- **db lens**: `packages/db/src/lens/{lensFor,redactLens,rootLens,searchablePaths,orderablePaths}.ts`;
  `packages/db/src/registries/redactFields.ts` (`HOOK_REDACT_FIELDS`).
- **route helpers (lens-scoped filtering precedent)**: `apps/api/src/lib/routeTemplates/read.ts`,
  `.../filters/{buildSearchFieldsSchema,buildOrderBySchema}.ts`, `.../utils/prepareMiddleware.ts`,
  `apps/api/src/lib/prisma/buildWhereClause.ts`, `apps/api/src/types/appEnv.ts`, `routeTemplates/types.ts`.
- **docs**: `docs/claude/CONTEXT.md`, `docs/claude/API_ROUTES.md` (filterLens semantics).
- **zealot**: source of the un-ported `(c) => LensNarrowing` context cb (not on this machine).

## Open questions

- First-match vs all-match across an action's paths (leaning first-match).
- Does `available()` report near-miss reasons (for "why can't I")?
- Per-request context-scope: zealot's dedicated `mergeNarrowingWheres` merge **vs** a second
  narrowing layer underneath the lens chain (`{ parent: redactLens(lensFor(model)), root: { where } }`).
  Chain form is more uniform with redaction/picks; the merge form may exist because stacking multiple
  `root.where`s needs explicit AND-ing (json-rules narrowing where-semantics — "implication/negate to
  preserve filter-first meaning", per `applyLens`). Decide at build.
- "Must something change" (no-op guard) is **not** a tool concern — express it in the from/to
  predicates (`from: x=a`, `to: x=b`). Recorded as a decision, not a question.
