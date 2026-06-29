# INFRA-023: Serializable dynamic `where` — context-bind values in the Condition DSL

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: Medium (High once per-slug / per-tenant narrowings must persist as config — e.g. email templates)
**Created**: 2026-06-29
**Updated**: 2026-06-29

---

## Problem

A narrowing's `where` is the tenant/permission **scope** — "from what you can see, this is true" (`ModelDefaultNarrowing.where`). Today the only way to express a *tenant-specific* scope is a **runtime closure**:

```ts
scopeNarrowing((c) => ({ root: { where: { field: 'brandUuid', operator: 'equals', value: getBrand(c).uuid } } }))
```

The concrete `brandUuid` is baked in by the closure reading it off the request context; `buildWhereClause` folds the stacked chain into the query. That closure is **code, not data**, and that's the blocker:

- **It can't be persisted.** A narrowing whose scope is a closure can't be stored on a row, so a *brandless* config object — e.g. an email template default that every brand inherits — cannot carry its own tenant-scoped narrowing. The scope has to be re-supplied by a hand-written closure at every call site.
- **INFRA-016 doesn't cover it.** Serialization-by-ref keeps `where` as-is, but only as a **literal** Condition (`{ value: 'brand-abc' }`). Serializing the closure's output bakes one tenant's id in (defeats brandless); serializing without it loses the scope. There's no third option today.
- **`path` doesn't help.** `ValueSource = { value } | { path }`, and `path` resolves against the **evaluated subject** (the row being filtered) — it is row-relative. The tenant scope is an **external** parameter ("the current brand"), not a field of the row, so `path` can't express it.

Net: every dynamically-scoped narrowing is forced to be a code closure, so it can't ride serialized config — per-slug email narrowings, admin-saved lenses (INFRA-018), tenant→subtenant handoff (`seal`).

## Possible solution — a context-bind value type

Add a third `ValueSource` alongside `{ value }` (literal) and `{ path }` (row-relative): a **context-bind** token resolved at execution against a supplied bindings map.

```ts
// proposed
type ValueSource<T> =
  | { value: T;     path?: never; bind?: never }
  | { path: string; value?: never; bind?: never }
  | { bind: string; value?: never; path?: never };  // resolved from execution bindings
```

`{ bind }` is a third arm on the **shared** `ValueSource<T>` that every rule kind already uses, so it is valid **anywhere a literal can go** — equality, comparison, `in`/`notIn`, `contains`, `between`, aggregate — for free, no per-rule special-casing. (Date rules carry their own value shape; extend it identically.) A narrowing's `where` then reads `{ field: 'brandUuid', operator: 'equals', bind: 'brandUuid' }` — fully serializable, **brandless**, storable on the default config row.

**Projection is the one interpolation point.** `projectByPath(lens, { bindings })` and `exposedSurface(lens, { bindings })` fold binds into the projection exactly as 2.10 already folds `sourceValues` — same shape, sibling inputs. Without bindings the projection keeps the `{ bind }` tokens (the portable/serializable form); with bindings it resolves them to concrete values. The execution entry points (`applyLens` / `check` / `toPrisma` / `toSql` / `runSources`) accept a `bindings` map but resolve through that **same** projection path — one resolver, never two. In `toPrisma`/`toSql` a resolved `bind` is naturally a query **parameter**.

**Required bindings are introspectable + validated.** `requiredBindings(lensOrRule): Set<string>` — a `collectBinds` walk over the narrowing chain's `where`/`sources` and the rule — returns the set of bind **names** needed, so the builder / `exposedSurface` can declare "this surface needs `{ brandUuid }`." The two shapes are different: introspection is a `Set<string>` (names); the execution input is a `Record<string, RuleValue>` (name → value), since each `{ bind }` resolves to a value. At execution, validate `keys(bindings) ⊇ requiredBindings(lens)` and **throw on any missing required bind**: a forgotten tenant scope is a caller bug, and silently returning no rows would hide it (and risk an unscoped path slipping through).

The only runtime input is then the bindings map, supplied where context is known: `{ brandUuid: getBrand(c).uuid }` on an API request; `{ brandUuid: recipient.brandUuid }` at email send. The `scopeNarrowing((c) => …)` closure collapses into "a static serialized narrowing + a one-line bindings resolver."

**All of this lives in json-rules core** — the `{ bind }` value type, the resolver, `requiredBindings`, and bindings-folding in projection. Template and Zealot just pass a `bindings` map; no app-layer reimplementation.

### Properties

- **Leak-safe** — `exposedSurface` still strips `where` for the untrusted client; bind tokens never reach the browser.
- **Checkable** — `checkRuleAgainstLens` / `validateNarrowing` validate the token structurally (field exists, operator valid) without a value.
- **Closed vocabulary** — bind names must be a **declared set** (`brandUuid`, `recipientUuid`, `locale`, `senderId`, …), validated at deserialize, so a stored `where` can never reference unbound context.
- **Generalizes beyond email** — every `scopeNarrowing` closure becomes declarative data; admin-saved lenses (INFRA-018) carry their own scope.

## Open questions

- Token vocabulary + where it's declared (a per-app bindings registry?).
- Missing *required* binding → throw (decided above). Remaining nuance: distinguish a missing binding (caller bug → throw) from a deliberately-empty value (follows filter-first: fail closed, never widen).
- Interaction with `seal` (INFRA-016): does sealing resolve binds to literals for a fixed tenant, or preserve them for a still-dynamic subtenant?
- Is `requiredBindings` its own primitive, or surfaced through `describeRule` (INFRA-017)? (Proposing standalone, with `describeRule` able to include it.)

## Related Tickets

- **Sibling to** INFRA-016 (serialize structure-by-ref + `seal`) — this serializes the *dynamic where*; together they make a narrowing fully persistable.
- **Feeds** INFRA-017 (builder surface), INFRA-018 (lens builder — saved lenses carry scope).
- **Motivating consumer:** Zealot per-slug email narrowings (`userevidence/Zealot-Monorepo` ZLT-3169) — the default template can only carry its own narrowing as config once the brand scope is a bind token, not a closure.
