# INFRA-016: Lens Serialization by Reference

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: Medium (for persistence of registry-driven base lenses — admin-saved lenses, INFRA-018; NOT on the rules-builder or bindings critical path — the surface ships as server-provided JSON, and the bindings path reattaches a code-built parent)
**Created**: 2026-06-13
**Updated**: 2026-06-29

---

_Updated 2026-06-29: **`seal` dropped from this ticket** — see "Why no `seal`" below. Scope is now only the ref-id serialization form. Still Not Started — no `serializeLens`/`deserializeLens`, no `SerializedLens`/`SerializedNarrowing`, no `sourceRefs`/`bridgeRefs` ref-id form shipped. json-rules 2.10.0's serializable `{ lens, sourceValues }` wire shape is the **object form** (inline maps), not the ref-id form this ticket covers._

## Overview

`LensNarrowing.parent` is a live object pointer to its parent `Lens` /
`LensNarrowing` (see the TODO at `src/lens/types.ts`). Composing or projecting a
narrowing therefore drags the **entire parent graph** — every source `FieldMap`
and bridge — inline. That's fine in-memory but wrong for persisting a lens whose
base is itself registry-driven.

**Two orthogonal axes — do not conflate them (we did):**
1. **Representation** — *object form* (`parent` inlined) vs *ref-id form* (`parent`
   = a lens id; sources/bridges = registry refs). Serialization is just the ref-id
   form; the lens is **already serializable in object form** (`JSON.stringify`
   works — `maps` are data, `bridges` ref maps by name, `where` is a `Condition`,
   and a context `{ bind }` is plain JSON — see FEAT-004).
2. **Surface** — *full lens* (`where` + physical details, server-side) vs
   *client-exposed surface* (`where` + physical details stripped, leak-safe) =
   `exposedSurface` (INFRA-017, shipped).

`where` is part of the lens DSL and lives in the lens. **Serialization never strips
it.** Only the *surface* axis (`exposedSurface`) strips it, for the untrusted
client. This ticket is axis 1.

**Why ref-id, not inline — this is the point, not size:** inlining the parent +
maps + bridges produces a **snapshot** — a frozen copy. A persisted lens/narrowing
must stay **live to upstream changes**. Storing the narrowing + *refs* (parent lens
id, source-map ids, bridge ids) means deserialization resolves against the
**current** registry, so when an upstream source map gains a field, a bridge is
re-defined, or the parent lens evolves, **every persisted narrowing reflects it on
load** — automatically. Inlined copies silently go stale. This is *config*
liveness, distinct from source **data** (the hydrated rows are a runtime snapshot,
never serialized as config — a saved lens refs the source's *schema*, then
re-hydrates live data at query time).

> **The bindings path (FEAT-004) does not need this ticket.** A per-slug email
> narrowing stores its *delta* (`root.where`/`sources`/picks, with `{ bind }`
> tokens — all plain JSON) and reattaches `parent: <code-built base lens>` at load.
> The code-built base is inherently current, so liveness is free without a registry.
> Ref-id only earns its keep when the **base lens itself** is persisted /
> registry-driven (admin-saved lenses, INFRA-018).

## Why no `seal`

`seal` was the planned where-preserving collapse for a **tenant→subtenant handoff**
— hand a subtenant a lens with the tenant's `where` baked in tamper-proof so they
could narrow further and **run their own queries** without escaping scope.

That trust boundary doesn't exist in our architecture (decided 2026-06-29):

- **Each party authors only its own narrowing layer** — data (`where`/`sources`/
  picks + bind tokens), never an executable lens.
- **The server is the sole executor.** It stacks the chain (parent floor → child
  layers), resolves each layer's `{ bind }` tokens from *its own* authenticated
  context, and calls `toPrisma`/`check`. No subtenant ever holds or runs a scoped
  lens off-server.

So the parent floor is enforced **structurally**, not by a sealed artifact:
`applyLens` ANDs every layer root→leaf, `validateNarrowing` keeps the chain
narrow-only (a child can only add filters, never widen past the parent), and binds
resolve server-side and layer-local (`parent:name` lets a child *read* a parent's
value but never re-bind it — FEAT-004). Even the browser never executes: it gets a
where-stripped `exposedSurface` and submits a rule the server re-validates +
re-scopes.

`seal` would only return if we ever ship a **runnable** lens off-server (edge
function, another service, a client running its own queries). We don't, and the
bind model actively discourages it (resolution wants the auth context, which lives
server-side). If that day comes, `seal` is a small `exposedSurface`-keep-`where`
variant + a retained collapsed narrowing layer — spin a fresh ticket then.

## Type taxonomy (canonical)

Two shapes, each with an in-memory (object) form and a wire (ref) form. Naming must
always make clear which you hold.

| Shape | In-memory | Wire (serializable) |
| --- | --- | --- |
| **Lens** (maps intact — the graph) | `Lens` / `LensNarrowing` — `parent` = object, maps/bridges inlined | `SerializedLens` / `SerializedNarrowing` — `parent` = id; sources/bridges = registry refs |
| **Projection** (path-keyed view) | `PathProjection` (`Map`), includes `where` | `SerializedProjection` — plain object; **keeps `where`** (a client projection is one derived from `exposedSurface`, where already absent) |

```ts
type SerializedLens = { id; sourceRefs: string[]; bridgeRefs: string[]; mapName; model };
type SerializedNarrowing = { id; parent: string /* id */; root?; mapDefaults? };
// serialize/deserialize resolve against { sources: Registry, bridges: Registry }
```

Parallel types (not a `parent: Lens | string` union) keep the choice —
inline-and-in-memory vs ref-and-persistable — explicit in the *type you hold*, not a
runtime flag.

## Objectives

- Parallel serializable types (`SerializedLens`/`SerializedNarrowing`/`SerializedProjection`)
- `serialize`/`deserialize` round-tripping against source + bridge registries
- Data (source snapshots) is never serialized as config

## Tasks

- [ ] Stable identity for lenses and narrowings (id/name)
- [ ] `serializeLens` / `serializeNarrowing` → ref-based JSON (no embedded maps)
- [ ] `deserializeLens` resolving source-schema refs + bridge refs (INFRA-015)
- [ ] Round-trip tests, incl. a multi-source narrowed lens (with `{ bind }` tokens preserved)
- [ ] Document the persistence model

## Open Questions

- Refs as opaque ids vs. human-readable names? (names double as the `maps` keys)
- Does the projection/surface (INFRA-017) ship alongside the serialized lens, or is
  it re-derived on load?

## Definition of Done

- [ ] Lens + narrowing chain round-trip via refs, no embedded parent graph
- [ ] Bridge/source refs resolve against their registries
- [ ] `{ bind }` tokens survive the round-trip
- [ ] Docs + tests

## Related Tickets

- **Depends on**: INFRA-015 (bridge registry)
- **Feeds**: INFRA-017 (surface), INFRA-018 (lens builder, for admins — saves/loads serialized lenses)
- **Relates to**: FEAT-004 (context bindings — makes the dynamic `where` serializable; does not depend on this ticket)
