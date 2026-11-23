# FEAT-027: Status and Role Changes as Transitions

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: High
**Created**: 2026-11-22
**Updated**: 2026-11-22
**Related**: [FEAT-018](./FEAT-018-transitions.md) (the transitions primitive), [AUTH-004](./AUTH-004-rebac-bridges-schema-layering.md) § Transitions (adoption deferred until a second lifecycle; this is it), [FEAT-028](./FEAT-028-inquiry-lifecycle-as-transitions.md) (Inquiry, later), template #313 (integration resource soft delete and revive)

---

## Overview

Some writes are legal only from one state to another, and only for some actors: an
integration resource's `status`, a re-registration that would bring a deleted resource back,
a member's `role`. Today the member role check is written by hand (load the row as it is and
as it will be, run `memberRoleWrite` on both), and the resource status has no rule at all
beyond the request schema refusing `missing`. `@inixiative/transitions` is the primitive for
exactly this: `from` is checked against the current row, `to` against the merged row, each
side with a legality predicate and a rebac permission, and it returns a reason that maps to
409 (predicate) or 403 (permission). This ticket makes template its first consumer.

Aron, 2026-11-22: "This would be a transition, I would say. In fact, this is exactly a
transition, and we probably should make it a transition. If the other one isn't a
transition, we should make it a transition too. The one I just said, the member role,
that's what transitions are for." On create: "Create and update should probably have a
very similar state machine, or maybe not a similar state machine, but should be using the
same idea."

## Objectives

- An integration resource's status changes, and its registration, go through one set of
  transitions with the actor rules below.
- Member role changes (`organizationUser`, `spaceUser`) go through transitions instead of the
  hand-written before/after check.
- Every create-if-missing on a plain unique that revives a tombstone is an upsert (one
  pattern, not two).

---

## The rules

### Who acts

The check already supplies who is acting (`packages/permissions/src/rebac/check.ts`,
`actor:Acting.model` and `actor:<Model>`, permissions 0.27). Two actor rules, both positive:

- **The resource's own integration is acting**: `actor:Acting.model = Token`,
  `actor:Token.ownerModel = Integration`, `actor:Token.integrationId exists`, and
  `{ field: 'integrationId', operator: 'equals', path: 'actor:Token.integrationId' }`. A
  token of a different integration fails even when granted `manage` on this one.
- **A person is acting**: `actor:Acting.model = User`, or a Token whose `ownerModel` is one of
  the non-integration owner models (`kind.ruleKindIsOneOf`, as `actorIsDelegateOfUser` does).

Both sit beside the ordinary relation walk (`{ rel: 'integration', action: 'manage' }`): the
walk decides who is related to the resource, the actor rule decides which kind of party is
writing. Superadmin passes as everywhere.

**Kingdom**: the actor kinds there gain `Signet`. When the writer acts through a Signet owned
by an integration, the same rule passes only when that Signet's owner integration is this
resource's integration ("is this the integration, and is the integration the actor").

### Integration resource status (`db:integrationResource`)

| From → to | A person | The resource's own integration |
|---|---|---|
| tracked → untracked | yes | no |
| untracked → tracked | yes | no |
| missing → untracked | yes | no |
| tracked → missing | no | yes |
| missing → tracked | no | yes |

Aron, 2026-11-22: "integration resources should be able to move missing to tracked, but
should not be able to touch untracked."

The update body accepts every status (the 422 on `missing` goes); the transition decides.

### Registering a resource (create as a transition)

Registration is an upsert on `(integrationId, kind, externalId)`, so its starting row is one
of three. The library has no separate create: a create is a transition from no row.

| Starting row | Result | Who |
|---|---|---|
| none | new, tracked | `manage` on the integration (unchanged) |
| live | name and metadata refreshed, status kept | same |
| deleted, was tracked or missing | revived (links deleted with it come back) | same |
| deleted, was untracked | revived and tracked only when the body says `status: 'tracked'` and the actor may make untracked → tracked; otherwise 409 | a person; never an integration |

Aron, 2026-11-22: "If you specifically change it back to tracked, then it revives, right?
Otherwise, it just doesn't. You have to track it to revive it." An integration re-registering
its resources therefore never undoes a person's untrack.

### Member role (`db:organizationUser`, `db:spaceUser`)

One action whose `from.permission` and `to.permission` are both `memberRoleWrite(tenant)`
(`packages/permissions/src/rebac/rebacSchemaRules.ts`), replacing the two `check` calls in
`apps/api/src/modules/organizationUser/controllers/organizationUserUpdate.ts` and the
spaceUser equivalent. `validateNotLastOwner` stays where it is: it counts rows, it is not a
row predicate.

### One revive pattern

These still use `revive()` then create, and answer 409 on a live duplicate; they move to
`db.withDeleted(() => db.<model>.upsert(...))` with `update` carrying `deletedAt: null` (and,
for Contact, the field resets `freshContact` applies today). All four already have plain
uniques.

- `apps/api/src/modules/contact/services/reviveOrCreateContact.ts` (`[userId|organizationId|spaceId, type, valueKey]`)
- `apps/api/src/modules/organization/controllers/organizationCreateAuthProvider.ts` (`[organizationId, provider, type]`)
- `apps/api/src/modules/inquiry/services/inviteOrganizationUser/index.ts` (`[organizationId, userId]`)
- `packages/email/src/render/saveScopedRow.ts` revives by id; check whether it is a create-if-missing at all before moving it.

---

## Tasks

### Transitions in template

- [ ] Add `@inixiative/transitions` 0.9.0 (permissions 0.27, json-rules 4.6; being published by the primitives train, session inixiative-7c)
- [ ] Transition rules beside the rebac schema in `packages/permissions/src/` (one file per resource's transitions)
- [ ] `createAuthorize({ schema: rebacSchema, map: schemaMap, data })` with `data` giving the same actor rows `check.ts` builds (one builder, shared, not a copy)
- [ ] The seam AUTH-004 named: a `validateTransition` step after `validatePermission.ts`, before the controller; `Reason` → `makeError` 403 (permission only) or 409 (any predicate), message from `describe(reason)`
- [ ] Check first that `checkTransition` accepts an empty current row with a no-row predicate (the create case); the docs do not cover it

### Integration resource

- [ ] Status transitions per the table; update body takes every status
- [ ] Registration transitions per the table; create body accepts `status: 'tracked'` only
- [ ] Actor rules (`actorIsThisIntegration`, `actorIsPerson` or names from `docs/claude/NAMING.md`) in `rebacSchemaRules.ts`

### Member role

- [ ] `changeRole` transition for `organizationUser` and `spaceUser`; controllers call it instead of `check` × 2

### Upserts

- [ ] Contact, AuthProvider, organization-user invite onto upsert; `saveScopedRow` checked
- [ ] `revive()` keeps its cascade-revive callers (parents reviving children); remove it only if nothing else uses it

### Docs

- [ ] `docs/claude/PERMISSIONS.md`: transitions section (who acts, the seam, 403 vs 409)
- [ ] `docs/claude/DATABASE.md`: one revive pattern
- [ ] `.foundry/regions/lib-transitions` and `permissions-rebac` (and TRACKING.md's stale `__actor` item for lib-transitions)

---

## Open Questions

- Who sets `missing` in Kingdom: does the sync act through the integration's own token, or run as a job with no actor? With no actor the rule only limits API callers. Settle before the Kingdom port.
- A live untracked resource registered again: the table keeps it untracked (status kept). Confirm.

---

## Implementation Notes

Primitives used, by concern:

| Concern | Primitive |
|---|---|
| Transition legality and authz | `@inixiative/transitions` `checkTransition`, `createAuthorize`, `describe` |
| Permissions | rebac schema `packages/permissions/src/rebac/schema.ts`; kind rules `makeKindRules` (`rebacSchemaRules.ts`); `holdsOnRecord` `apps/api/src/lib/permissions/holdsOnRecord.ts` |
| Who acts | supplied actor rows, `packages/permissions/src/rebac/check.ts`, `packages/db/src/schemaMap.ts` |
| Request seam | `apps/api/src/middleware/validations/validatePermission.ts` |
| DB writes | native `upsert` inside `db.withDeleted` on plain uniques (`docs/claude/DATABASE.md` § Row Locks) |
| Errors | `makeError` (`#/lib/errors`) |

No new machinery: the before/after pair the member controller builds by hand is what
`checkTransition` does.

---

## Definition of Done

- [ ] A test per row of each table, plus a different integration's token refused
- [ ] Member role tests unchanged in outcome
- [ ] One revive pattern; no `revive()`-then-create left for create-if-missing
- [ ] Docs and regions updated
- [ ] Full check green; PR for Aron; Kingdom port after review (Tribe paused, TRIBE-QUEUE.md)
