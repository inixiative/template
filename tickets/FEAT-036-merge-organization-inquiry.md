# FEAT-036: `mergeOrganization` Inquiry (Organization → Organization)

**Status:** 🆕 Not Started · **Line:** FEAT · **Priority:** Low · **Related:** `mergeUser` Inquiry, `transferSpace` Inquiry, FEAT-033 (`transferProject`)

## Context

`mergeUser` merges one person's duplicate user into another. A company that signed up twice, or two teams that should be one tenant, need the same thing one level up: every record the source organization owns moves to the target, and the source organization is removed.

Why an Inquiry: a merge moves one tenant's data into another, so both sides must agree. The source's owner sends it and the target's owner approves it, just as `transferSpace` works today. The approval is the audit record of that consent.

## Proposed Scope

Build it on the `mergeUser` machinery (`apps/api/src/modules/inquiry/services/mergeUser/`): a repoint queue seeded from the schema's own key columns (an `organizationKeyColumns` beside `userKeyColumns`, so a new `Organization` FK is covered without a hand-kept list), collisions found before each write through `fetchRowAlreadyHoldingTheUniqueKey` (never caught), and one transaction.

1. **Inquiry shape:** content `{ sourceOrganization: { id, name } }`; the resolution is an exact copy of the content, a sanity check that the approver is approving the organization they think they are. Source `Organization` (`own`), target `Organization` (`own`).
2. **Rules:**
   - The target wins every collision. Where both organizations hold a record with the same unique key (a member, a tag, a setting key, a one-per-owner integration), the target's row is kept, every row pointing at the source's row is queued to point at the target's, and the source's row is soft-deleted through the normal path, so hooks, audit and cascades run. A tombstone the target holds gives way to a live source row, as in `mergeUser`.
   - Every Inquiry the source is a party to is repointed.
   - Audit logs are repointed for every subject model except `Organization`. Rows about the source `Organization` itself stay as history.
3. **Steps on approval:**
   - Lock both organizations (`db.findForUpdate`).
   - Merge members: a user who is a member of both keeps the target's `OrganizationUser` (and its role). The rest move, and `ON UPDATE CASCADE` re-keys their member-owned rows.
   - Move every source `Space` to the target through the `transferSpace` service, so spaces follow one path whether moved alone or in a merge.
   - Repoint the remaining `organizationId` columns through the registry, then clear row caches (the cascade bypasses the cache hook, as `clearSpaceRowCaches` handles today).
   - Hard-delete the source organization inside a merge scope like `db.withUserMerge`, where `preventHardDelete` allows only the planned deletes and `immutableFields` only the planned writes. Clear the source from audit columns that orphan before the delete, as `orphanAuditColumnsOfSourceUser` does, then close edges whose two ends became one organization (`closeRowsWhoseEndsBecameOneRecord`).
4. **Integrations:** a one-per-owner provider held by both keeps the target's integration. The source's integration is soft-deleted, and the Signet grants on it degrade as on any deleted integration. Project links that pointed at it are reported in the approval view before the owner approves.
5. **Open questions for Aron before building:**
   - Should a source member's role ever beat the target's (for example, owner of the source but a plain member of the target)?
   - Project names and other per-owner name uniques: drop the source row, or rename it with a suffix?
   - Are billing and subscriptions in scope, or does a merge refuse while the source has an active subscription?
