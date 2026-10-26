# AUTH-010 — Entitlement anchors as rule references

**Status:** 🆕 Not Started · **Line:** AUTH · **Priority:** Medium · **Related:** #219, #218 (rule references rework)

## Context

A delegate's stored entitlements (`{ resource, anchor, where?, actions }` on Token and Integration, and on member rows after #219 item 15) point at an anchor record. When that record is deleted, the entitlement grants nothing: the library denies an entry whose anchor is absent. But the dead entry stays in the stored JSON, and a permissions update re-checks the current entries first (`integrationUpdate.ts` → `validateEntitlementGrants`), which answers 422 for the missing anchor. Nobody, superadmins included, can then change that delegate's permissions until the entry is removed by hand.

## Direction

Use rule references (`apps/api/src/hooks/ruleReference/`), the machinery segments and email templates already use: each stored entitlement's anchor is a reference from its holder (Token, Integration, OrganizationUser, SpaceUser) to the anchor record. When the anchor is soft-deleted, the stale event removes that one entry from the holder's `entitlements`; a revive restores it the way rule references regenerate today. The stored JSON then never holds a dead entry.

Build on #218 (one declaration table and hook), not the current shape.

## Alternative: entitlements as their own table

Store each entitlement as a row — holder (Token, Integration, OrganizationUser, SpaceUser), `resource`, anchor (polymorphic foreign key), `where`, `actions` — instead of JSON on the holder. The database then enforces the shape, deleting an anchor cascades (or soft-deletes) its entitlement rows without rule references, and "who holds what on this record" becomes a query. Install reads the rows through the same cached hydration. Weigh against the rule-reference route above before building either.

## Open

- Revive: restore the removed entry, or leave it gone.
- Whether the holder's writes (create/update) sync its reference edges through the same declaration as segments and templates.
