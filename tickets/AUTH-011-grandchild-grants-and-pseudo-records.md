# AUTH-011 — Grandchild grants and reach as a condition

**Status:** 🆕 Not Started · **Line:** AUTH · **Priority:** Low · **Related:** #221, AUTH-008, permissions 0.9.0

## Context

An entitlement `{ resource, anchor, where?, actions }` reaches a record when the anchor is that record or its direct owner (R55, `directOwner` in `packages/db/src/utils/directOwner.ts`). A grant is checked on a pseudo record placed at the anchor (`ownerColumns` + `hydrate`) and given the values its `where` pins exactly; the library grant check reads what it does not carry as unknown (json-rules `absent: 'unknown'`), and every rule and `where` is positive (`validateRule(…, { positive: true })`). Every row above the pseudo record is real.

## Grandchild grants

An entitlement anchored at a parent reaching records whose direct owner sits under it, such as integrations of any space in the organization. The rows between the record's direct owner (the child anchor) and the entitlement's anchor (the parent anchor) then vary per record, so the path between the two anchors (`space.organization`) is what propagates: conditions along it are carried, re-rooted by that path (`prefixConditionFields`, json-rules 3.10.0), plus the anchor's identity as `<path>.id = <parent anchor id>`. At run time `onPath` walks the tenancy tree up to the anchor.

Re-rooting leaves leaves inside an array or aggregate condition element-relative and refuses `$$.` scope refs; positive rules ban those shapes today, so this only matters if they come back. No consumer asks for grandchildren: Kingdom's Signets are explicit allowlists ("Wildcards, implicit descendants, and unregistered resource IDs are not supported", `kingdom/docs/kingdom.md`).

## Reach as a condition (listing)

"What can this token reach" (Kingdom's `access/describe`) is the walk compiled for a whole collection: OR over the entitlements, AND the walk, then `toPrisma`. Prior art: permissions `d08125d` on `origin/feat/v1-actions-collections`, `src/condition.ts` — `createConditionCompiler().toCondition` (reach for `(resource, action)` with an `over`/`under` approximation for arms it couldn't express: bridge hops, row `permissionRules`, depth) and `implies` (sound, incomplete). Removed in `6bc01a6`. Rebuild it on the current `evaluate` walk, not by reviving the file.

## To figure out

- Bridges when granting: authority that arrives through a bridge hop needs the far row in `subject.data`; the grant check supplies none, so it is never granted.
