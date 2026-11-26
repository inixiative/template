# AUTH-014 — Nested `down` list walks vs. `ArtifactEffectivePermission`

**Status:** 🆕 Not Started · **Line:** AUTH · **Priority:** Low · **Related:** PR #72 (`FEAT-009`), `packages/permissions/src/rebac/artifactResourcePermission.ts`

## Context

In `FEAT-009`, every `Artifact` already owns its direct `artifactPermissions: ArtifactPermission[]`, and `ArtifactAncestor` already flattens container hierarchy into one list (`artifactAncestorsAsDescendant: ArtifactAncestor[]`). Ideally, `db:Artifact` ReBAC rules would evaluate inherited permissions by walking `artifactAncestorsAsDescendant → ancestorArtifact → artifactPermissions` directly without materializing a second derived table (`ArtifactEffectivePermission`).

Today `@inixiative/permissions` strictly forbids crossing a second list under a `down` list (`packages/permissions/src/core/evaluate.ts`: `if (walk.under) return algebra.none`) so `down` hydration never performs an unbounded list × list fan-out. Because of that 1-list cap, PR #72 introduced `ArtifactEffectivePermission` to flatten `ancestors × permissions` into a single `down` list on `Artifact`.

Aron, 2026-11-24: "Each artifact, including containers, has its own permissions that allow you to share them. I don't know why we need effective permissions, honestly, because each artifact already has its permissions... Let's keep effective permissions for this initial pass, but if there's some sort of ticket for tracking permissions, this is now a smell, and we should consider how we would write it, but it's hard."

## Smell & Open Questions

- **Write amplification & dual materialization:** `ArtifactEffectivePermission` duplicates grant membership onto every inheriting descendant (`O(descendants × grants)` rows) solely to satisfy the 1-list `down` limit.
- **How could `@inixiative/permissions` support this safely?**
  - Bounded 2-level `down` hydration (with row/fan-out caps) vs. keeping `ArtifactEffectivePermission` as a materialized index (and/or compiling `ancestors → ancestorArtifact → permissions` directly to SQL joins once `INFRA-026` / `AUTH-013` query compilation lands).
  - Redis cache invalidation trade-off: without `ArtifactEffectivePermission`, mutating a permission on a root folder must still evict cached descendants (or fetch ancestor permissions separately from the cached artifact row).
