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

## Grammar (pinned)

Two block tags + a modifier. Three shapes, everything composes from them:

```
{{component:name}}{{/component:name}}                                              -- ref, no children
{{component:name}} {{slot:name}}…{{/slot:name}} {{/component:name}}                 -- caller override
{{component:name}} {{slot:name:default}}…{{/slot:name:default}} {{/component:name}} -- component default
```

`{{component:x}}` / `{{slot:x}}` are distinguished from `{{lens.field}}` interpolation by the `:` and the matching `{{/…}}` close.

**Empty default holds position (invariant).** Every declared slot always materializes a `:default` region — empty if nothing was authored. So there is no "missing slot" branch at render (override present → inject, else render default, possibly empty), the decomposer always has an explicit component-owned region per slot, and the slot keeps its structural place when empty. Normalization: on component save, ensure each declared slot has a `:default` region. In a structural MJML position the empty default is a minimal *valid* placeholder (e.g. an empty `mj-column`), not literally nothing, so fragment validation still passes.

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
- [x] `expand.ts` — rewrite: inject overrides at slot markers, render `:default` for unfilled slots, thread per-call-site slot content; attribution-aware recursion. **Done** — now a thin wrapper over `renderBlocks` (see below); signature dropped the redundant `componentRefs` arg (refs are discovered from the parse tree, single source of truth = the MJML). Callers updated: `compose.ts` (×2), `save.ts`, `apps/api/.../emailVersioning/hook.test.ts` (×2).
- [x] `compose.ts` — call-site updated to the new `expand(mjml, ctx)` signature.
- [ ] `validateNoCycle.ts` — no edges through overrides/passthroughs; test that a wrapper-with-slot doesn't register its fill.
- [ ] `saveComponents` — slot-aware fragment validation: `{{#slot:name:default}}` defaults must be valid MJML; bare `{{slot}}` only in flow positions.
- [ ] Tests — named slots; defaults (filled vs unfilled); empty-default holds position; nested wrappers; a component inside a default (owned) vs inside an override (attributes to caller); noop/shadow/fork routing; 3-way diff against a moved base.

## Implementation progress (2026-07-03)

Built the **grammar + render** foundation first, TDD, decoupled from the DB-heavy save path:

- **`packages/email/src/render/parseBlocks.ts`** — pure, DB-free parser. Tokenizes the pinned grammar (`{{#component:slug}}`, `{{#slot:name}}`, `{{#slot:name:default}}`) into a node tree (`text` / `component` / `slot{isDefault}`). It is **syntax only** — it does *not* decide ownership (override vs injection, caller vs component); that semantic layer lives in the consumers. Interpolation (`{{lens.field}}`) and `{{#if}}` are opaque text to it.
- **`packages/email/src/render/renderBlocks.ts`** — pure render core, `renderBlocks(mjml, load)` with an injected `load(slug) => Promise<string>`. Per `{{#component}}`: collect caller override slots, load the component body, and for each slot marker inject the override else render the `:default`, recursing throughout. DB-free and fully unit-tested.
- **`expand.ts`** wraps `renderBlocks` with a cascade-backed, per-slug-memoized loader (dedups the old N+1; missing slug → `EmailRenderError('component_missing')`).
- Tests: `parseBlocks.test.ts` (9) + `renderBlocks.test.ts` (8) cover all three shapes, empty-default-holds-position, same-slug self-nesting, and the nesting-regression render. Full suite green: 17 unit + 106 email-pkg + 6 versioning (incl. the no-drift invariant).

Backward-compatible: existing pre-slot components (bare refs, no slot markers) render identically under the tree walk.

## Follow-ups surfaced during build

- **`recomposeSnapshot` will drift once slots carry overrides.** `apps/api/src/lib/email/recompose.ts` uses its own regex `replaceBlock` (a *second* block matcher, separate from `expand`) that replaces the whole `{{#component:slug}}…{{/component:slug}}` block — **ignoring caller override slots**. Today (no slot data) it matches `expand` and the no-drift test passes; the moment a template fills a slot, snapshot recomposition and live composition diverge. Recompose must be made slot-aware against pinned child bodies (reuse `parseBlocks`/`renderBlocks`, don't re-fork block matching — cf. COMM-006). Own slice.
- **Lens-aware interpolation** (raised 2026-07-03): all interpolation is lens-scoped. Decided lens set: **`sender`, `recipient`, `data` (generic/loose bag — the per-template unknown payload), `system`** (platform-injected values). A style/theme lens was floated but is not adopted. `interpolate.ts` grows a `system` lens alongside the existing `sender|recipient|data`; `data` stays a generic `Record<string, unknown>`. Larger direction the user is driving toward: a **typed template registry** (each template declares its lenses + the shape of its `data`) and a **custom template options matrix** (per-template options that expand into a render matrix). Registry/matrix design is being interrogated separately; the lens interpolation change lands with the slot work.
- [ ] **Nesting regression test** — a parent shipping a child pre-filled:
  ```
  {{component:hero}}
    {{slot:body:default}}
      {{component:cta}}{{slot:label}}Get started{{/slot:label}}{{/component:cta}}
    {{/slot:body:default}}
  {{/component:hero}}
  ```
  Assert: `hero.componentRefs` includes `cta` (ref sits in hero's default → hero owns it); the `{{slot:label}}` override lives in **hero's** default content, not on `cta`'s row; render → hero's default body = `cta` with label "Get started".

## Side case (not in the general flow)

Editing a component at a **parent tenancy** is not reachable from template editing (which is downward-only, current-tenant). It's an explicit manual action in the component editor, gated to operators with rights at that tier. Only upward write; only place a "used in N templates" warning is needed.

## Related

- COMM-001 (email system), COMM-006 (versioning — depth-aware block matching must be reused, not re-forked).
- Zealot `ZLT-3271` (port target — `@zealot/email`), `ZLT-3272` (builder + lens layer that consumes this).

## Origin

Surfaced from the Zealot MJML authoring work (ZLT-3139, `userevidence/Zealot-Monorepo#1574`). Filed upstream so template and Zealot don't drift. Design converged in Zealot `ZLT-3271`/`ZLT-3272` on 2026-07-03 and synced back here.
