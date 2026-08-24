# AUTH-004: ReBAC — cross-source bridges, schema layering & rule-surface bounding

**Status**: ✅ Done — migrated to `@inixiative/permissions@^0.3.0` + validated (bridges supported & tested)
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-06-29
**Updated**: 2026-06-29

---

## Overview

`@inixiative/permissions@0.3.x` changed the rebac schema/check contract to support cross-source
(bridge) relation walks (reusing json-rules' bridge machinery) and added a raw `boolean` `ActionRule`
(`true` = allow, `false` = deny; `null` still denies). This ticket covers (1) the template's adoption
(done) and (2) the follow-on primitives surfaced during design (schema layering, rule-surface
bounding) that are deliberately **not** built yet.

`0.3.0` also carries one real fail-OPEN fix from adversarial review: a `oneToMany` bridge could be
walked onto its "many" side, where the engine collapsed the list to an arbitrary `found[0]` (a
non-deterministic wrong-allow). Now fails closed. (`true`/allow is a valid default permission value, so
empty `all` = true / empty `any` = false is the intended boolean identity — not a hole.)

## Engine contract (shipped in 0.3.x)

```ts
type RebacSchema<R> = { bridges?: Bridge[]; permissions: Partial<Record<R, ResourcePermission>> };
type ResourcePermission = { actions: Record<string, ActionRule> };   // NO sibling key (see below)
type ActionRule = string | RelationCheck | RuleCheck | SelfCheck | {any} | {all} | boolean | null;
type Subject<R> = { resource: R; record: Row; data?: Record<string, Row[]> };
check(permix, schema, subject, action);          // bound check
createRebacCheck(resolveRelation);               // resolveRelation(resource, segment) => resource | null
```

- `permissions` lives under a key; `bridges` sit alongside → the schema is self-contained for traversal.
- Identity is the map-qualified `resource`. Renames vs the old contract: `model→resource`,
  `ModelPermission→ResourcePermission`, `ResolveModel→ResolveRelation`.
- Bridge `rel` hops traverse **synthetically**: read the join-key scalar (enough for an rbac grant),
  fall back to the dictionary the engine builds from `subject.data` only when a downstream action reads
  the far record's fields.

### Why `actions` has no sibling key

- **JSON abac is not a per-resource concern.** `{ rule: { field: 'content.role', … } }` (JSON
  sub-path) and `path:`-references resolve in json-rules `check`; what marks a field JSON is the
  **model's fieldMap** (`kind: 'Json'`), not the permission entry.
- **Bounding "what rules may reason about" is per-consumer×resource**, so it belongs in the future
  overlay layer, not the base entry.
- Adding an optional `narrowing?`/`surface?` later is **additive / non-breaking**.

---

## Migration — as built

**The rule that drove everything:** the `map:` prefix is an **identity + traversal-boundary** concern,
not a "sprinkle it everywhere" one.

- **Prefix lives on identity:** schema keys (`db:user`), permix grants, the far-resource identity the
  resolver returns, bridge endpoints, and cross-source `subject.data` keys.
- **Bare inside a fieldmap:** traversing *within* `db` uses the bare accessor — the resolver strips the
  prefix to look models up in `prismaMap`, and `hydrate()` already keys relations by bare accessor. The
  prefix is re-applied only to the far-resource *identity* it returns.

**Casing:** `db:<accessor>` — lowercase, matching `AccessorName` (e.g. `db:user`, `db:organization`).
The resolver does the `upperFirst`/`lowerFirst` dance internally, since that's the seam to `prismaMap`'s
PascalCase model keys. (We chose accessor-cased over `db:User` because rebac is the *permission* layer,
which is accessor-cased throughout — grants, call sites, `AccessorName` — and only the data layer
(`prismaMap`/FieldMap/bridge endpoints) is PascalCase.)

**No `toResource` helper, no wrapper magic.** Qualification is explicit at each *source* of a resource
reference (schema keys, role grants), exactly as the schema keys are explicit. The permix wrapper stays
a generic `${resource}:${id}` keyer. The engine is untouched.

### Files changed

- `packages/permissions/package.json` — `@inixiative/permissions` `^0.1.0` → `^0.3.0`.
- `rebac/types.ts` (+ package `index.ts`, `rebac/index.ts`) — `ModelPermission` → `ResourcePermission`;
  `RebacSchema = EngineRebacSchema` (resource generic left open `string` — consumer-extensible).
- `rebac/schema.ts` — wrapped `{ bridges: [], permissions: { 'db:user': … } }`; top-level keys
  `db:`-prefixed (lowercase). `rel:` targets, delegate strings, `path:`/`field:` stay bare.
- `rebac/check.ts` — `ResolveModel` → `ResolveRelation`; resolver strips `db:` → `upperFirst` →
  `prismaMap` lookup → returns `db:${lowerFirst(field.type)}`. Wrapper builds the `Subject`
  (`resource: \`db:${model}\``) and gained an optional `data?` param for cross-bridge ABAC.
- `client.ts` — `PermissionEntry.resource` and the permix wrapper's `check` resource → `string`; the
  wrapper stays **generic** (no `db:` logic). `AccessorName` import dropped.
- `roles/{user,organization,space}.ts` — grants are explicit: `resource: 'db:user'` / `'db:organization'`
  / `'db:space'` (covers backend setup *and* the frontend store, which use the same helpers).
- `rebac/ownerActions.ts`, `rebac/permissionRulesSchema.ts` — type rename;
  `rebacSchema.permissions[\`db:${model}\`]`.
- `rebac/check.test.ts` — fixtures wrapped + `db:`-keyed; grant setups qualified; **+2 bridge tests**.

**Roles edits ("#4") were reopened deliberately:** with a `db:`-keyed schema the engine checks
`permix.check('db:organization', …)`, so grants *must* carry the map to match — and stripping to a bare
model in the engine would collide (`db:User` vs `crm:User` → both `User:id`). The map is part of a
grant's identity. So the grant *source* (roles) declares it, explicitly. The wrapper was the wrong layer.

---

## Bridges — supported & tested

Two tests in `rebac/check.test.ts` prove cross-source walks end-to-end (`db:user` → `crm:account` via
the `accountId` join scalar):

- **rbac-terminal** — grant on the far (`crm:account`) resource; no `data` needed. (This test caught the
  original "qualify in the permix wrapper" bug, which keyed a `crm:account` grant as `db:crm:account:…`.)
- **abac-after-bridge** — far `crm:account` fields come from `subject.data`; the wrapper's `data` param
  threads them through.

The template is single-source today (`bridges: []`), so this is dormant in production but proven and
ready. Cross-source grants are declared explicitly qualified at their source (e.g. `crm:account`), same
as db grants are `db:…`.

## Validation

- **81 permissions tests pass** (incl. the 2 bridge tests, the Contact `path:'user.email'` rule, rel
  walks, cycle detection).
- **All 10 workspaces typecheck**; biome clean on the package.
- Not run here: full `bun run check` is blocked by env artifacts unrelated to this change — nested
  `.worktrees/*/biome.json` (root lint) and a pre-existing UI store circular-init under `bun test`
  (`createClientSlice` before init, untouched by this migration).

---

## Transitions (`@inixiative/transitions`) — DEFER adoption (evidence-based)

The transition **engine** is at parity (map-qualified `resource`, bridge-aware seam). Template
**adoption** waits:

- **No consumer** — `@inixiative/transitions` is imported nowhere in the template.
- **One real lifecycle** — `inquiry` (`draft → sent → {changesRequested, approved, denied, canceled}`),
  validators in `apps/api/src/modules/inquiry/validations/validateInquiryStatus.ts` +
  `services/resolution.ts`. `CommunicationLog`/`WebhookEvent` are job-driven and simple. Not enough
  heterogeneity to earn a framework.
- **No multi-source/bridges** today.

**Recommendation:** keep the hand-rolled validators; **document the seam** — a `validateTransition`
slots into `validatePermission.ts` (post-permission, pre-controller), checking from-state legality +
authz on the change. Adopt + refactor `inquiry` (first adopter) when a 2nd/3rd divergent lifecycle
appears.

---

## Follow-on primitives (designed, NOT in scope — own tickets when prioritized)

1. **Schema layering / inheritance** (multi-tenant): base → org → space, a child overrides/adds actions
   and inherits the rest; resolution falls through the parent chain. Fork: **restrict-only** (a tenant
   can never escalate past the platform — safer) vs **override**. Distinct from per-record
   `permissionRules` (row-level, additive) and from lens narrowing (reduces a *data surface*; this
   composes *authz*).
2. **Consumer-authored actions + rule-surface bound**: consumers declare new actions on a model and
   author abac rules — bounded by a **lens/narrowing** limiting which fields those rules may reference (a
   per-consumer security boundary). Likely the overlay's optional `surface?`/`narrowing?`.

## Builder status (`@inixiative/rules-builder@0.11.0`, shipped)

Permissions + Transitions tabs demo the headless hooks. Authoring covers: `path`/value-by-reference,
multi-hop `rel` (relation picker → action from the target resource's defined permissions), the
`{ bridges, permissions }` shape, fieldMaps/bridges scope selectors, **booleans as a leaf** (field ⇄
`true`/`false`) and `allow`/`deny` (= `true`/`false`) ActionRule kinds, and a bare (un-wrapped) rule
root. Deferred polish: stable IDs for action/transition tree nodes.

## Related

- `@inixiative/permissions@0.3.0` (engine) · `@inixiative/json-rules` (bridges/`buildBridgeDictionary`)
- `@inixiative/transitions@0.0.3` (engine at parity; adoption deferred)
- `@inixiative/rules-builder@0.11.0` (visual authoring)
- **FEAT-008** — Permissions Builder (frontend)
