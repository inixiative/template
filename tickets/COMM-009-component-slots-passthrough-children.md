# COMM-009: Component slots — passthrough children that aren't registered subcomponents

**Status**: 🟡 Designed — ready to build
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-06-29
**Updated**: 2026-07-03

---

## Overview

The component composition engine registers *every* nested block. In `packages/email/src/render/extractRefs.ts`, `processLevel` extracts each `{{#component:slug}}…{{/component:slug}}` into the `RefMap` (deduped + variant-indexed via `cleanRefs`), pushes it onto the parent's `refs`, and `saveComponents` persists it as its own `EmailComponent` row; `expand.ts` resolves it through the owner cascade (`lookupCascade`) and `validateNoCycle` guards it.

There is no way to author a **structural wrapper** — a `layout` / `card` / `button-shell` whose job is to wrap caller-provided content — without that inner content becoming a shared, registered, cascading component. The two workarounds are both bad: inline the wrapper at every call site (no reuse), or fragment every bit of content into named components (registry bloat, and one-off local content wrongly becomes shared and subject to the owner cascade + versioning backprop).

## Proposal — a slot/fill primitive

Add `{{slot:name}}` (and a bare `{{slot}}` = a single default slot). A slot marks a passthrough position for caller-provided content. Unlike a component ref, a slot is **not** extracted into the `RefMap`, **not** registered/deduped, **not** cascaded, and **not** cycle-checked. At expand time the slot is filled with the caller's body for that named slot.

- **Named children sections** — a component may expose several named slots (a `card` with `header` / `body` / `footer`). In-scope.
- **Default children** — a slot may carry default content, rendered when the caller doesn't fill it. Block form `{{#slot:footer}}…default…{{/slot:footer}}`; the self-closing `{{slot:name}}` form has no default (renders empty if unfilled).
- **Explicit fill syntax** — the caller targets a slot with `{{#fill:name}}…{{/fill:name}}`. Required both to target named slots and to disambiguate fill from an inline component definition (see Dependency attribution).

Grammar: keep it in the existing `{{#…}}` / `{{…}}` family so the extractor and parser stay uniform — **not** a single-brace token (`{childpassthrough}`), which collides with `{{var}}` interpolation and `{{#if rule=…}}` conditionals.

## Dependency attribution (the subtle requirement)

When component X is used inside component Y's **fill** — `{{#component:Y}}{{#fill:body}}{{#component:X}}…{{/component:X}}{{/fill:body}}{{/component:Y}}` — X is the **caller's** content passing through Y's slot. So **X is a child of the caller (the template/component that supplied the fill), not of Y**:

- No `Y → X` edge. X is **excluded from Y's `componentRefs`**.
- Y's fills are **not** cascaded as Y's children, **not** cycle-checked against Y, and **not** included in Y's version back-propagation.
- The fill's refs attribute to the **caller's** `componentRefs` instead.

This is exactly why fills need explicit `{{#fill}}` syntax — it's the only way `extractRefs` can tell "caller fill (attribute up)" from "Y's inline definition (attribute to Y)" at decompose time.

## Tasks

- [ ] `extractRefs.ts` — recognize `{{slot}}` / `{{#slot}}` and `{{#fill}}`; skip slots from the `RefMap` (never a ref); **attribute fill refs to the caller, not the slotted component**.
- [ ] `expand.ts` — fill slots from the caller's body at compose time (a new slot-fills input alongside `componentRefs`); render default content when unfilled; reuse the depth-aware block matching (see COMM-006 §1), not a third divergent parser.
- [ ] `saveComponents` / `saveTemplate` — slots persist nothing; a fill's refs land on the **caller's** refs, not the wrapper's.
- [ ] `validateNoCycle.ts` — slots/fills aren't refs, can't form a cycle; add a test that a wrapper-with-slot doesn't register or cycle-check its filled content.
- [ ] Tests — one and multiple named slots; default children (filled vs unfilled); nested wrappers; a fill whose body contains a real `{{#component}}` ref (the ref registers on the **caller**, not the wrapper).

## Open Questions

- **Optionality.** Recommendation: optional-by-default — an unfilled slot with no default renders empty (not an error); a slot with default content renders its default. Required-slot enforcement only if a component needs it.
- **Manifest vs implicit.** Does a component *declare* its slots, or are they implicit from markup? Lean implicit for the engine; the builder infers the slot list from markup to render fill regions and validate that required slots are filled.

## Related Tickets

- COMM-001 (email system), COMM-006 (email versioning hardening — §1 flags the brace-naive `replaceBlock` regex; slot replacement must reuse the depth-aware matching).
- **Zealot `ZLT-3271`** — the port target (mirror this primitive in `@zealot/email`).
- **Zealot `ZLT-3272`** — the email-builder design that consumes this primitive (named children / default children in the palette).

## Origin

Surfaced from the Zealot MJML email authoring work (ZLT-3139, `userevidence/Zealot-Monorepo#1574`). Filing upstream so template and Zealot don't drift — this is a composition-engine primitive, not Zealot-specific. Design converged in Zealot `ZLT-3271` / `ZLT-3272` on 2026-07-03 (fill syntax, dependency attribution, named + default children); synced back here.
