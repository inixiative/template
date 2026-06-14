# INFRA-018: Lens Builder

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: Medium
**Created**: 2026-06-13
**Updated**: 2026-06-13

---

## Overview

A UI/tooling layer (in **`rules-builder`**) to compose a `Lens` and its
`LensNarrowing`s without writing them by hand: pick the entrypoint
(source + model), assemble sources and bridges, and author narrowings
(picks/omits, enum narrowing, `where` scope) at the model-default and
path-specific layers.

Output is a serialized lens (INFRA-016) that the rules builder (INFRA-002) then
turns into an authoring surface (INFRA-017).

## Objectives

- Choose entrypoint (source map + anchor model)
- Add/select source maps (from importer, INFRA-013) and bridges (from registry, INFRA-015)
- Author narrowings: picks/omits, enum picks/omits, `where` scope, at
  model-default vs path-specific layers
- Save/load via ref-based serialization (INFRA-016)
- Live preview of the resulting exposed surface (INFRA-017)

## Tasks

- [ ] Entrypoint picker (source + model)
- [ ] Source/bridge assembly UI backed by registries
- [ ] Narrowing editor (model-default + path-specific), enforcing monotonic
      restriction (`validateNarrowing`)
- [ ] Preview pane showing `exposedSurface` output as the surface narrows
- [ ] Save/load serialized lenses
- [ ] Headless core + injected components (see INFRA-002 component approach)

## Open Questions

- How much of the path-specific narrowing tree to expose in v1 vs. model-default
  only?
- Shared component-injection contract with the rules builder?

## Implementation Notes

- Build on `validateNarrowing` (construction-time monotonic checks),
  `exposedSurface` (preview), and `projectByPath` (path-specific divergence).
- Like the rules builder, prefer accepting components via an interface + shipping
  an example set rather than bundling UI.

## Definition of Done

- [ ] Compose + narrow + save/load a lens end-to-end
- [ ] Preview reflects narrowing live
- [ ] Tests on the headless core

## Related Tickets

- **Depends on**: INFRA-013, INFRA-015, INFRA-016, INFRA-017
- **Feeds**: INFRA-002 (rules builder)
