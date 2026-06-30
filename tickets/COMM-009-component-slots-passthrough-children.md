# COMM-009: Component slots — passthrough children that aren't registered subcomponents

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-06-29
**Updated**: 2026-06-29

---

## Overview

The component composition engine registers *every* nested block. In `packages/email/src/render/extractRefs.ts`, `processLevel` extracts each `{{#component:slug}}…{{/component:slug}}` into the `RefMap` (deduped + variant-indexed via `cleanRefs`), pushes it onto the parent's `refs`, and `saveComponents` persists it as its own `EmailComponent` row; `expand.ts` resolves it through the owner cascade (`lookupCascade`) and `validateNoCycle` guards it.

There is no way to author a **structural wrapper** — a `layout` / `card` / `button-shell` whose job is to wrap caller-provided content — without that inner content becoming a shared, registered, cascading component. The two workarounds are both bad: inline the wrapper at every call site (no reuse), or fragment every bit of content into named components (registry bloat, and one-off local content wrongly becomes shared and subject to the owner cascade + versioning backprop).

## Proposal — a slot primitive

Add `{{slot:name}}` (and a bare `{{slot}}` = a single default slot). A slot marks a passthrough position for caller-provided content. Unlike a component ref, a slot is **not** extracted into the `RefMap`, **not** registered/deduped, **not** cascaded, and **not** cycle-checked. At expand time the slot is filled with the caller's inline body for that named slot.

Named slots: support several per component (a `card` with `header` / `body` / `footer`). Bare `{{slot}}` collapses to one unnamed slot.

Grammar: keep it in the existing `{{#…}}` / `{{…}}` family so the extractor and parser stay uniform — **not** a single-brace token (`{childpassthrough}`), which collides with `{{var}}` interpolation and `{{#if rule=…}}` conditionals.

---

## Tasks

- [ ] `extractRefs.ts` — recognize the slot marker in `extractBlocks` / `processLevel` and skip it (never enters `RefMap`, never pushed to `refs`). A slot is content passthrough, not a ref.
- [ ] `expand.ts` — fill slots from the caller's body at compose time: a new compose-time input (the slot fills) alongside `componentRefs`, with a `replaceBlock` analog for slot regions that reuses the depth-aware block matching (see COMM-006 §1).
- [ ] `saveComponents` / `saveTemplate` — slots are not refs, so nothing is persisted for them; confirm the save path ignores slot markers.
- [ ] `validateNoCycle.ts` — unaffected (slots aren't refs, can't form a cycle); add a test that a wrapper-with-slot doesn't register the filled content.
- [ ] Tests — wrapper with one and with multiple named slots; nested wrappers; a slot whose fill itself contains a real `{{#component}}` ref (the ref still registers, the slot does not).

---

## Open Questions

- Single anonymous slot now vs. named slots from the start. Recommendation: ship `{{slot:name}}` with bare `{{slot}}` defaulting to one unnamed slot — costs nothing extra and avoids a v2 grammar break.
- Should a component *declare* its slots (a manifest), or are they implicit from the markup? Implicit is simpler; a manifest would let the builder/preview validate that every required slot is filled.

---

## Related Tickets

- COMM-001 (email system), COMM-006 (email versioning hardening — §1 already flags the brace-naive `replaceBlock` regex; slot replacement must reuse the depth-aware matching, not add a third divergent parser).

---

## Origin

Surfaced from the Zealot MJML email authoring work (ZLT-3139, `userevidence/Zealot-Monorepo#1574`). Filing upstream so template and Zealot don't drift — this is a composition-engine primitive, not Zealot-specific.
