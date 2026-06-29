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

**`where` (and its binds) are server-only — that's the protection.** Two artifacts, per INFRA-017: `exposedSurface` is the client-facing surface and is **`where`-stripped**, so neither a `where` nor a `{ bind }` token ever reaches the browser. `projectByPath` keeps `where` (`ProjectedVisit.whereClauses`) and is server-side only. Binds therefore resolve **server-side**: into (a) the source-eligibility queries that produce `sourceValues` — the option lists the client *does* receive, as resolved values, never the binds — and (b) the execution `where` via `applyLens`/`toPrisma`/`toSql`. You protect the scope by **never sending it**, not by trying to make a sent object immutable; the rule the client returns is independently re-validated (`checkRuleAgainstLens`) and the server's `where` is folded in regardless of what the client submits. `bindings` fold into the **server** projection exactly as 2.10 folds `sourceValues` — without bindings the projection keeps `{ bind }` tokens (the portable form), with bindings it resolves them; one resolver, and `toPrisma`/`toSql` emit a resolved bind as a query **parameter**. (If you want the user to *see* their scope as UX — "scoped to your brand" — that's a separate, explicitly read-only informational field, never the executable `where`.)

**Required bindings are introspectable + validated.** `requiredBindings(lensOrRule): Set<string>` — a `collectBinds` walk over the narrowing chain's `where`/`sources` and the rule — returns the set of bind **names** needed, so the builder / `exposedSurface` can declare "this surface needs `{ brandUuid }`." The two shapes are different: introspection is a `Set<string>` (names); the execution input is a `Record<string, RuleValue>` (name → value), since each `{ bind }` resolves to a value. At execution, validate `keys(bindings) ⊇ requiredBindings(lens)` and **throw on any missing required bind**: a forgotten tenant scope is a caller bug, and silently returning no rows would hide it (and risk an unscoped path slipping through).

The only runtime input is then the bindings map, supplied where context is known: `{ brandUuid: getBrand(c).uuid }` on an API request; `{ brandUuid: recipient.brandUuid }` at email send. The `scopeNarrowing((c) => …)` closure collapses into "a static serialized narrowing + a one-line bindings resolver."

**All of this lives in json-rules core** — the `{ bind }` value type, the resolver, `requiredBindings`, and bindings-folding in projection. Template and Zealot just pass a `bindings` map; no app-layer reimplementation.

### Properties

- **Leak-safe** — `exposedSurface` still strips `where` for the untrusted client; bind tokens never reach the browser.
- **Checkable** — `checkRuleAgainstLens` / `validateNarrowing` validate the token structurally (field exists, operator valid) without a value.
- **Closed vocabulary** — bind names must be a **declared set** (`brandUuid`, `recipientUuid`, `locale`, `senderId`, …), validated at deserialize, so a stored `where` can never reference unbound context.
- **Generalizes beyond email** — every `scopeNarrowing` closure becomes declarative data; admin-saved lenses (INFRA-018) carry their own scope.

## Progressive binding (partial application)

Narrowings compose (`parent` chain), so binding is **monotonic partial application**, not all-or-nothing:

- Any layer may introduce `{ bind }` tokens in its `where`/`sources`.
- `resolveBindings(lensOrNarrowing, bindings)` is a chain→chain transform: it resolves the tokens the map covers and **leaves the rest as tokens**; `requiredBindings` shrinks accordingly.
- Stages bind what they know: `{ brandUuid }` at request/author time, `{ recipientUuid }` at send. Execution (`check`/`toPrisma`) requires `requiredBindings` to be **empty** — else throw.
- Resolving only ever **narrows** (a bound literal adds a concrete filter), never widens — consistent with the chain's existing narrow-only invariant (`validateNarrowing`).

This is exactly what `seal` (INFRA-016) needs: sealing for a fixed tenant = resolve that tenant's binds to literals, **preserve** the subtenant's binds as tokens. `seal` becomes "partial bind + collapse."

**Nuance — per-layer name collisions.** A flat bindings map keys by name, so two layers both using `{ bind: 'brandUuid' }` for *different* brands (tenant vs subtenant) would conflate. Resolve stage-by-stage (each stage supplies only its layer's names), or namespace bind names per layer; reject same-name/different-meaning across layers at `validateNarrowing` time.

## Open questions

- Token vocabulary + where it's declared (a per-app bindings registry?).
- Missing *required* binding → throw (decided above). Remaining nuance: distinguish a missing binding (caller bug → throw) from a deliberately-empty value (follows filter-first: fail closed, never widen).
- Interaction with `seal` (INFRA-016): does sealing resolve binds to literals for a fixed tenant, or preserve them for a still-dynamic subtenant?
- Is `requiredBindings` its own primitive, or surfaced through `describeRule` (INFRA-017)? (Proposing standalone, with `describeRule` able to include it.)

## Related Tickets

- **Sibling to** INFRA-016 (serialize structure-by-ref + `seal`) — this serializes the *dynamic where*; together they make a narrowing fully persistable.
- **Feeds** INFRA-017 (builder surface), INFRA-018 (lens builder — saved lenses carry scope).
- **Motivating consumer:** Zealot per-slug email narrowings (`userevidence/Zealot-Monorepo` ZLT-3169) — the default template can only carry its own narrowing as config once the brand scope is a bind token, not a closure.
