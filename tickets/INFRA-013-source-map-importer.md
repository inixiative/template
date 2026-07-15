# INFRA-013: Source-Map Importer (Non-Prisma Sources)

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: Medium (multi-source vision — NOT blocking COMM-001/FEAT-008/FEAT-003)
**Created**: 2026-06-13
**Updated**: 2026-06-13

---

## Overview

`@inixiative/prisma-map` reflects a Prisma schema into a json-rules `FieldMap`.
We need the same for non-Prisma sources (Salesforce, CRMs, custom/external
schemas) so they can participate in a `Lens` as additional maps and be bridged
to the Prisma source. Lives in **`rules-builder`** (all builders live there).

A `FieldMap` is `{ models: Record<string, ModelEntry>, enums? }` where each
field is `{ kind: 'scalar'|'object'|'enum'|'bridge', type, isList?, values? }`.
The importer's only job is to produce that shape from a foreign schema
description.

## Objectives

- Importer(s) that turn a non-Prisma schema into a valid `FieldMap`
- Output passes `validateFieldMap` from json-rules
- Pluggable per source type; shared core, source-specific adapters

## Tasks

- [ ] Define the importer contract (input schema description → `FieldMap`)
- [ ] Salesforce adapter (objects/fields/picklists → models/fields/enums)
- [ ] Generic/JSON-schema adapter for arbitrary external sources
- [ ] Map foreign types → `FieldKind` (String/Int/DateTime/Enum/…)
- [ ] Emit `enums` registry from picklists/enumerations
- [ ] Validate output with `validateFieldMap` / `validateFieldMapSet`
- [ ] Tests per adapter

## Open Questions

- One package per source vs. one importer with adapters? (lean: shared core +
  adapters)
- Do importers run at build time (codegen, like prisma-map) or runtime (live
  describe calls)? Salesforce describe is live — may need both modes.

## Implementation Notes

- Output is **schema only** — no data. Runtime rows are the "source" half
  (see INFRA-014) and are hydrated separately.
- Reuse `FieldKind` from json-rules' operator catalog for type mapping.

## Definition of Done

- [ ] At least one non-Prisma adapter producing a `validateFieldMap`-clean map
- [ ] Generic adapter covering arbitrary JSON-schema-like sources
- [ ] Tests + docs

## Related Tickets

- **Feeds**: INFRA-014 (source primitive), INFRA-015 (bridges), INFRA-018 (lens builder)
- **Mirrors**: `@inixiative/prisma-map`
