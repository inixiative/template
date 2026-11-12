# AUTH-008 — Collections filtered by what you can read, and the parked #219 decisions

**Status:** 🆕 Not Started · **Line:** AUTH · **Priority:** Medium · **Related:** #219, #210 (collection endpoints)

## Context

#219 moved collection actions toward the pseudo-record rule: a create or a list under an owner checks the action on a pseudo record of the child model, so the rule lives with the child. Some lists don't fit that shape, and some decisions were parked to keep #219 landable. This ticket holds them.

## Collections filtered by what you can read

A list answers "which of these can I get into", not "may I see this list at all". Anyone who can read the owner can call the list; the rows it returns are the ones the caller can read. Example: an organization's spaces — anyone who reads the organization lists spaces, and each space appears with what the caller can see of it. #210 has two collection endpoints built toward this; start from them.

- **Organization spaces (`GET /organization/:id/spaces`):** stays on `read` of the organization (the real model, not a pseudo record) until the filtered list exists.

## Parked decisions

All list questions below are one class of problem — reason about them together here. In #219 they stay a model check (read on the real owner), not a submodel check.


- Member-shaped lists (organization users, my organizations and spaces), customer/provider lists, segment memberships: how they get a pseudo record, or whether they become filtered lists.
- Inquiries' two sides (source, target): whether routes declare which side.
- A bad body on a forbidden create answering 400 before 403.
- Segments in general, including "conditions required" as a `RulesRegistry` rule.
- Auth providers: owners see disabled ones — as a `read` rule on `db:authProvider`.
- Stored entitlements re-parsed on every request: keep or drop.
- Token list `read`: `own` only for now; revisit.
