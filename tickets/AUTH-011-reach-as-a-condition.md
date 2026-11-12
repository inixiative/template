# AUTH-011 — Reach as a condition

**Status:** 🆕 Not Started · **Line:** AUTH · **Priority:** Low · **Related:** AUTH-008, permissions 0.11

## Context

An entitlement `{ resource, anchor: { resource, id, path? }, where?, actions }` reaches a record when the record's hydrated `anchor.path` leads to the anchor, each polymorphic step being the kind its relation names (`organization` = an organization's own integrations, `space.organization` = its spaces'). A grant is checked on the pseudo record the library's `placeEntitlement` builds from the hydrated anchor along the path, plus the `where`'s exact `equals` values; what it does not carry reads as unknown (json-rules `absent: 'unknown'`), and every rule and `where` is positive.

## Reach as a condition (listing)

"What can this token reach" (Kingdom's `access/describe`) is the walk compiled for a whole collection: OR over the entitlements, AND the walk, then `toPrisma`. Prior art: permissions `d08125d` on `origin/feat/v1-actions-collections`, `src/condition.ts` — `createConditionCompiler().toCondition` (reach for `(resource, action)` with an `over`/`under` approximation for arms it couldn't express: bridge hops, row `permissionRules`, depth) and `implies` (sound, incomplete). Removed in `6bc01a6`. Rebuild it on the current `evaluate` walk, not by reviving the file.

## To figure out

- Bridges when granting: authority that arrives through a bridge hop needs the far row in `subject.data`; the grant check supplies none, so it is never granted.
