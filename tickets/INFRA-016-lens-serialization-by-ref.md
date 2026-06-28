# INFRA-016: Lens Serialization by Reference + `seal`

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: Medium (High for persistence + multi-tenant delegation; NOT on the first rules-builder critical path — the surface can ship as server-provided JSON first)
**Created**: 2026-06-13
**Updated**: 2026-06-27

---

_Updated 2026-06-27: still Not Started — no `serializeLens`/`deserializeLens`, no `SerializedLens`/`SerializedNarrowing`, no `seal`, and no `sourceRefs`/`bridgeRefs` ref-id form shipped. Note for disambiguation: json-rules 2.10.0 added a serializable `{ lens, sourceValues }` wire shape for the builder surface — but that is the **object form** this ticket already calls "works today" (axis 1's left column), carrying inline maps, **not** the ref-id form. The ref-id serialization + `seal` (this ticket's actual scope) remain unbuilt._

## Overview

`LensNarrowing.parent` is a live object pointer to its parent `Lens` /
`LensNarrowing` (see the TODO at `src/lens/types.ts:50`). Composing or projecting
a narrowing therefore drags the **entire parent graph** — every source `FieldMap`
and bridge — inline. That's fine in-memory but wrong for persistence and for
shipping across a trust boundary: it's huge, duplicative, and embeds server-side
`where` scope.

Two things land together here: a **parallel serializable type hierarchy** (refs,
not object pointers), and **`seal`** — the where-preserving collapse that makes a
tenant→subtenant handoff safe.

**Two orthogonal axes — do not conflate them (we did):**
1. **Representation** — *object form* (`parent` inlined) vs *ref-id form* (`parent`
   = a lens id; sources/bridges = registry refs). Serialization is just the ref-id
   form; the lens is **already serializable in object form** (`JSON.stringify`
   works — `maps` are data, `bridges` ref maps by name, `where` is a `Condition`).
2. **Surface** — *full lens* (`where` + physical details, server-side) vs
   *client-exposed surface* (`where` + physical details stripped, leak-safe) =
   `exposedSurface` (INFRA-017, shipped).

`where` is part of the lens DSL and lives in the lens. **Serialization never strips
it.** Only the *surface* axis (`exposedSurface`) strips it, for the untrusted
client. The axes compose: you serialize either a full lens (`where` kept) or an
exposed surface (`where` already gone before serialization). This ticket is axis 1.

**Why ref-id, not inline — this is the point, not size:** inlining the parent +
maps + bridges produces a **snapshot** — a frozen copy. A persisted lens/narrowing
must stay **live to upstream changes**. Storing the narrowing + *refs* (parent lens
id, source-map ids, bridge ids) means deserialization resolves against the
**current** registry, so when an upstream source map gains a field, a bridge is
re-defined, or the parent lens evolves, **every persisted narrowing reflects it on
load** — automatically. Inlined copies silently go stale. This is *config*
liveness, and it's distinct from source **data**: the hydrated rows are genuinely a
runtime snapshot and are never serialized as config (a saved lens refs the source's
*schema*, then re-hydrates live data at query time).

## Type taxonomy (canonical)

Two shapes, each with an in-memory (object) form and a wire (ref) form. Naming
must always make clear which you hold.

| Shape | In-memory | Wire (serializable) |
| --- | --- | --- |
| **Lens** (maps intact — the graph) | `Lens` / `LensNarrowing` — `parent` = object, maps/bridges inlined | `SerializedLens` / `SerializedNarrowing` — `parent` = id; sources/bridges = registry refs |
| **Projection** (path-keyed view) | `PathProjection` (`Map`), includes `where` | `SerializedProjection` — plain object; **keeps `where`** (serialization never strips it; a client projection is one derived from `exposedSurface`, where already absent) |

```ts
type SerializedLens = { id; sourceRefs: string[]; bridgeRefs: string[]; mapName; model };
type SerializedNarrowing = { id; parent: string /* id */; root?; mapDefaults? };
// serialize/deserialize resolve against { sources: Registry, bridges: Registry }
```

Parallel types (not a `parent: Lens | string` union) keep the leak-prone choice —
inline-and-trusted vs ref-and-shippable, where-kept vs where-stripped — explicit
in the *type you hold*, not a runtime flag.

## `seal` — the tenant→subtenant handoff (NEEDS A DESIGN PASS)

The motivating case: a tenant has a narrowed lens and wants to give a *subtenant*
a lens to narrow further and run their own queries. This is a different trust
boundary from the client surface, and the mechanism differs accordingly:

- **Untrusted client (browser, no SDK):** must bake/prune so reading the surface
  reveals nothing hidden, and strip `where`. That's `exposedSurface` (INFRA-017).
- **Semi-trusted subtenant (runs the SDK):** protection comes from chaining their
  narrowing *under* the tenant's and letting `checkRuleAgainstLens`/`applyLens`
  enforce at author + execution time — `validateNarrowing` already makes the chain
  monotonic (narrow-only, never widen). The subtenant inherits the tenant's `where`
  scope floor through that chain. Baking is only *also* needed here if the tenant
  must hide a field's **existence** from the subtenant.

Two corrections to the naive picture:

1. **Per-path narrowing cannot be "preserved in the maps."** A model-keyed map
   physically can't represent "field visible at path A, hidden at path B" (the
   collapse problem that retired `projectNarrowing`). Per-path narrowing must live
   in a **retained collapsed narrowing layer**, not baked into maps.
2. So `seal` is "serialize/collapse the narrowing chain into a base lens **plus a
   retained collapsed narrowing layer** (carrying `where` + path-specific)," NOT a
   where-preserving `exposedSurface`. Whether `seal` *also* prunes the maps (to hide
   field existence) depends on the threat model and is an **open design decision**.

Open before building `seal`:
- [ ] Pin the threat model: is the subtenant trusted to only act through the SDK,
      or must field *existence* be hidden (⇒ prune maps too)?
- [ ] Decide the output shape: serialized chain vs. collapsed-to-one-layer vs.
      map-pruned + retained narrowing.
- [ ] Confirm `where` rides in the retained narrowing layer (applied via `applyLens`),
      never in bare maps.

## Objectives

- Parallel serializable types (`SerializedLens`/`SerializedNarrowing`/`SerializedProjection`)
- `serialize`/`deserialize` round-tripping against source + bridge registries
- `seal` — where-preserving, path-preserving collapse for cross-trust-boundary handoff
- Data (source snapshots) is never serialized as config

## Tasks

- [ ] Stable identity for lenses and narrowings (id/name)
- [ ] `serializeLens` / `serializeNarrowing` → ref-based JSON (no embedded maps)
- [ ] `deserializeLens` resolving source-schema refs + bridge refs (INFRA-015)
- [ ] `seal(lensOrNarrowing)` → `SerializedLens` (where + path-specific preserved, baked)
- [ ] (Separate axis — NOT serialization) `where`-stripping + physical-detail
      stripping (`dbName`, `fromFields`/`toFields`, `relationName`, bridge `on`;
      client needs only `{ kind, type, isList, values }`) for the untrusted client
      is `exposedSurface` (INFRA-017, shipped). Serialization keeps both; a client
      artifact is the exposedSurface output serialized. Do **not** fold this into
      `serialize`.
- [ ] Round-trip tests, incl. a multi-source narrowed lens
- [ ] `seal` tests: subtenant can't read past / can't widen; `where` floor inherited;
      path-specific restriction survives (no union-collapse leak)
- [ ] Document the persistence + trust-boundary model

## Open Questions

- Refs as opaque ids vs. human-readable names? (names double as the `maps` keys)
- Does the projection/surface (INFRA-017) ship alongside the serialized lens, or
  is it re-derived on load?
- Should `seal` be its own ticket if it grows? (currently folded here — it's the
  same workstream: producing concrete/ref'd lenses for handoff)

## Definition of Done

- [ ] Lens + narrowing chain round-trip via refs, no embedded parent graph
- [ ] Bridge/source refs resolve against their registries
- [ ] `seal` produces a safe, monotonic, where-preserving base; leak tests pass
- [ ] Docs + tests

## Related Tickets

- **Depends on**: INFRA-015 (bridge registry)
- **Feeds**: INFRA-017 (surface), INFRA-018 (lens builder, for admins — saves/loads sealed lenses)
