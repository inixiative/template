# COMM-009: Component slots + hydrated-payload cascade-diff decomposer

**Status**: 🟡 Designed — ready to build
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-06-29
**Updated**: 2026-07-03

---

## Overview

The composition engine registers *every* nested block: `processLevel` extracts each `{{#component:slug}}…{{/component:slug}}` into the `RefMap`, and `resolveVariants` forks a wrapper into a `slug--N` row on any inline divergence. There is no way to author a **structural wrapper** (`card` / `layout` / `button-shell`) whose job is to surround caller-provided content, and inline edits contaminate shared component rows.

The design below (converged with Zealot `ZLT-3271`/`ZLT-3272`, 2026-07-03) replaces the extract/dedup/variant save path with a **cascade-diff decomposer over hydrated payloads**, and adds a **2-directive** slot/component grammar. It supersedes the earlier `{{#fill}}` / `{{#define}}` proposals — both collapse out.

## Directives (2 + a modifier)

- `{{#component:slug}}…{{/component:slug}}` — reference. **Open/close wraps children** (the passthrough). Empty = no passthrough, defaults render.
- `{{#slot:name}}…{{/slot:name}}` — a slot. In a component's own content = injection point; inside a component ref = an **override** (caller-owned passthrough).
- `{{#slot:name:default}}…{{/slot:name:default}}` — a slot carrying the component's **default child**. Hydrated into payloads for display; the FE **drops the `:default` modifier** (→ plain `{{#slot:name}}`) the instant a caller overrides it.

No `{{#define}}`, no `{{#fill}}`.

## Save — hydrated payload → cascade diff

The FE always sends a **fully-hydrated payload** (defaults inlined, marked `:default`). The BE decomposes by **diffing against the owner cascade `(slug, owner)`**, per `{{#component:slug}}` block, scoped to the **current tenant**:

- `:default`-marked slots = the component's own content; un-marked `{{#slot}}` = caller override → stored on the **caller (template/parent)** row.
- component's own content **== tenant's existing row** → **noop** (no write, no version bump).
- **== parent/platform** (differs from tenant, or no tenant row) → **inherit**: plain ref, no fork.
- **diverges from the whole cascade** → current-tenant write: **same slug = shadow, new slug = fork**.
- **3-way diff** against the base cascade version the FE hydrated from — avoids a stale upstream edit causing a spurious fork/noop.

Three tenant ops fall out of the one diff, **no fork primitive**: **override** (local), **shadow** (same slug, tenant-owned, cascade-shadows platform, keeps binding + inheritance), **fork** (new slug = a rename on the FE, decoupled).

## Dependency attribution (recursive)

- a `{{#component:Y}}` inside a **default** → the enclosing component **owns** it → normal parent→child edge.
- a `{{#component:Y}}` inside an **override/passthrough** → attributes to the **caller**, NOT the wrapper. Excluded from the wrapper's refs, cascade, cycle-check, version back-walk.
- Same `{{#component}}`; *which region it sits in* decides ownership.

## Render (rehydrate)

Resolve each `{{#component:slug}}` → load its row → per slot: override present → inject it (recurse); else render the `:default`. Then interpolate over the whole tree.

## Tasks

- [ ] **Cascade-diff decomposer** — replaces `mapRefs`/`cleanRefs` dedup + `resolveVariants` variant-indexing. Per component block: separate `:default` (component-owned) from un-marked overrides (caller-owned); 3-way diff vs cascade → noop / inherit / shadow / fork.
- [ ] `expand.ts` — rewrite: inject overrides at slot markers, render `:default` for unfilled slots, thread per-call-site slot content (signature change); attribution-aware recursion.
- [ ] `compose.ts` — thread slot content through the compose signature.
- [ ] `validateNoCycle.ts` — no edges through overrides/passthroughs; test that a wrapper-with-slot doesn't register its fill.
- [ ] `saveComponents` — slot-aware fragment validation: `{{#slot:name:default}}` defaults must be valid MJML; bare `{{slot}}` only in flow positions.
- [ ] Tests — named slots; defaults (filled vs unfilled); nested wrappers; a component inside a default (owned) vs inside an override (attributes to caller); noop/shadow/fork routing; 3-way diff against a moved base.

## Side case (not in the general flow)

Editing a component at a **parent tenancy** is not reachable from template editing (which is downward-only, current-tenant). It's an explicit manual action in the component editor, gated to operators with rights at that tier. Only upward write; only place a "used in N templates" warning is needed.

## Related

- COMM-001 (email system), COMM-006 (versioning — depth-aware block matching must be reused, not re-forked).
- Zealot `ZLT-3271` (port target — `@zealot/email`), `ZLT-3272` (builder + lens layer that consumes this).

## Origin

Surfaced from the Zealot MJML authoring work (ZLT-3139, `userevidence/Zealot-Monorepo#1574`). Filed upstream so template and Zealot don't drift. Design converged in Zealot `ZLT-3271`/`ZLT-3272` on 2026-07-03 and synced back here.
