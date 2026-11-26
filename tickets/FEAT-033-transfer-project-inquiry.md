# FEAT-033: `transferProject` Inquiry (Within-Tenant Ownership Transfer)

**Status:** 🆕 Not Started · **Line:** FEAT · **Priority:** Low · **Related:** PR #341 (`Project` `readAccess` / `operateAccess`), PR #72 (`transferArtifact` Inquiry), `transferSpace` Inquiry

## Context

`Project` supports 5-way ownership (`User`, `Organization`, `Space`, `OrganizationUser`, `SpaceUser`). A common workflow is a member starting a project in their own seat (`OrganizationUser` / `SpaceUser`) and later handing it over to the owning `Organization` or `Space` (or moving a project between `Organization` and `Space` within the same organization).

Cross-tenant transfers (`Org A` → `Org B` or `Org` → `User`) are intentionally **out of scope for phase one** because a `Project` can carry `ProjectIntegration` and `ProjectIntegrationResource` links whose tenant-boundary ownership (`projectIntegrationOwner` hook) would break across organizations.

## Proposed Scope (Phase 1 — Within-Tenant Transfer)

Follow the existing `transferSpace` and `transferArtifact` Inquiry patterns:

1. **Allowed transfer pairs (within one organization):**
   - `OrganizationUser` → `Organization` (same `organizationId`)
   - `SpaceUser` → `Space` (same `organizationId`, `spaceId`) or `Organization` (same `organizationId`)
   - `Organization` ↔ `Space` (same `organizationId`)
2. **Authority & approval:**
   - Sender needs `manage` on the source `Project`.
   - Receiver (`Organization` or `Space` `manage`) accepts or declines the Inquiry (under owner lock + `db.findForUpdate`).
3. **Linked records & cleanup on accept:**
   - **`ProjectIntegration` / `ProjectIntegrationResource`:** Verify every linked `Integration` remains valid under `projectIntegrationOwner` for the new owner (org-owned integrations stay valid moving `OrganizationUser` → `Organization` or `Organization` ↔ `Space`; member-owned `OrganizationUser`/`SpaceUser` integrations cannot belong to an org/space project and must either be detached with explicit confirmation or block the transfer).
   - **`Entitlement` rows anchored on `Project`:** Keep or revoke according to the transfer policy (at minimum, audit and ensure no stale member-seat grants survive unexpectedly).
   - **`Setting` rows on `Project`:** Carry over with the `Project` (all keyed by `resourceModel: 'Project', resourceId`).
   - **`readAccess` / `operateAccess`:** Reset to `private` / `private` (or carry over if explicitly requested by the receiver within the same tenant; must always reset to `private` if cross-tenant or `User` targets are ever added in phase two).
4. **Phase 2 (if ever needed):** Cross-tenant transfers (`User` → `Organization`, `Org A` → `Org B`) with explicit detachment of tenant-bound `ProjectIntegration` links and revocation of all `Project`-anchored `Entitlement`s.
