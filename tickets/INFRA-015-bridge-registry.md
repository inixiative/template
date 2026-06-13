# INFRA-015: Bridge Registry (Save & Reuse Bridges Across Lenses)

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: Medium (multi-source vision — NOT blocking COMM-001/FEAT-008/FEAT-003)
**Created**: 2026-06-13
**Updated**: 2026-06-13

---

## Overview

A `Bridge` (`{ endpoints: [{fieldMap, model, on}, {fieldMap, model, on}],
cardinality }`) is a fact about how two schemas relate — independent of any
lens's anchor. Today bridges are declared inline in every `createLens({ bridges
})` call, so the same `salesforce:Contact ↔ prisma:User` edge gets redeclared
for a User-anchored lens, a Contact-anchored lens, etc.

Bridges should be **defined once, stored, and referenced by id** from many
lenses.

## Objectives

- A persistable bridge registry: define a bridge once, reference by id
- `createLens` (and serialization, INFRA-016) accept bridge refs, resolving
  against the registry
- Backward compatible with inline bridges

## Tasks

- [ ] Bridge identity (id/name) + registry shape (`Record<id, Bridge>`)
- [ ] Resolve refs → bridges when stitching/creating a lens
- [ ] Allow `createLens` to take `bridgeRefs` alongside / instead of inline `bridges`
- [ ] Validate referenced bridges' endpoints exist in the lens's maps
- [ ] Tests: one registry bridge reused by two differently-anchored lenses

## Open Questions

- Registry as a plain object passed in, vs. a stateful registry object with
  `register()/get()`? (Lean: plain serializable map; statefulness is the host's.)
- Do bridge ids live in the registry only, or also embedded on the `Bridge`?

## Implementation Notes

- `stitchFieldMaps` injects bridge fields onto endpoint models — ref resolution
  must happen before stitching.
- This is the reuse half of the serialization story (INFRA-016): bridges are one
  of the things lenses reference rather than embed.

## Definition of Done

- [ ] Bridge defined once, referenced by ≥2 lenses in tests
- [ ] Inline bridges still work (no breaking change)
- [ ] Docs updated

## Related Tickets

- **Pairs with**: INFRA-016 (lens serialization by ref)
- **Related**: INFRA-013, INFRA-014
