# AUTH-013 — Role where and role serialize on lists

**Status:** 🆕 Not Started · **Line:** AUTH · **Priority:** Low · **Related:** #296 (inquiry delegate keys and owner lists)

## Context

A tenant's inquiry list shows everything on that tenant's channel to anyone who can `manage` it. Seeing is not resolving: `resolve` is a per-type level (`INQUIRY_TYPES`, `packages/permissions/src/rebac/inquiryTypes.ts`), so an admin can be shown a row only an owner may answer. Today the list neither filters those rows out nor marks them.

Aron, 2026-11-16: "We've said that admins can see inquiries for spaces and orgs, right? That's the tenant level. That doesn't mean they can respond to all of them… They'd be able to see them, but it would show that this is above your pay grade, or we could filter it out based on your role." And: "If you look at how Zealot does it, we have role where in place. Might be something we want to bring over… role where and role serialize." And: "The inquiry permissions right now are this object, and we need to build a reflection of that into the layer based on your role. It's doable, but I don't think it's high priority."

## Direction

Two reflections of the permission object onto a list, both derived from `INQUIRY_TYPES`, never a second hand-kept table:

- **Role where:** a filter added to the list query from the reader's role, so rows the reader could not act on are left out where a route asks for that.
- **Role serialize:** each row says what the reader may do with it (resolve, or read only), so the UI can show "above your pay grade" instead of a button that fails.

Start from Zealot's role where. It was not located in `~/code/zealot` main by name search on 2026-11-16 (`roleWhere`, role with where or serialize, in `apps/api` and `packages`); get the path from Aron before designing, and port its shape, not a new one.

## Open

- Filter or mark, per list: the tenant inbox probably marks; a "needs me" view filters.
- Whether this generalizes past inquiries to any list whose rows carry per-row action levels.
