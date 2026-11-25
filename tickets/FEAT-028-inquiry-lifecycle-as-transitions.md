# FEAT-028: Inquiry Lifecycle as Transitions

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Low
**Created**: 2026-11-22
**Updated**: 2026-11-22
**Related**: [FEAT-027](./FEAT-027-status-changes-as-transitions.md) (first transitions consumer), [FEAT-018](./FEAT-018-transitions.md), [AUTH-004](./AUTH-004-rebac-bridges-schema-layering.md) § Transitions (names Inquiry the first adopter), [FEAT-023](./FEAT-023-typed-inquiry-actions.md)

---

## Overview

Inquiry has the richest lifecycle in template (`draft → sent → {changesRequested, approved,
denied, canceled}`), checked by hand in
`apps/api/src/modules/inquiry/validations/validateInquiryStatus.ts` and
`apps/api/src/modules/inquiry/services/resolveInquiry.ts`, with per-type handlers under
`services/{changeEntitlements,createSpace,inviteOrganizationUser,transferSpace,updateSpace}/`.
Once FEAT-027 has template on `@inixiative/transitions`, describe it there too.

Held on purpose. Aron, 2026-11-22: "Inquiry has its own lifecycle, right? We could
potentially describe it in transitions, but you could also just write a ticket for that one.
It's a much more complicated thing. I'd rather not tweak it right now when I have a bunch of
other things to do."

## Objectives

- Each status change is a transition action (`send`, `requestChanges`, `approve`, `deny`,
  `cancel`, resend from `changesRequested`), with the type's resolve permission
  (`packages/permissions/src/rebac/inquiryTypes.ts`) as its permission.
- `available` gives the actions a party may take, for the UI; `eligible` gives the open set
  (expiry, a deleted party cancelling its open inquiries).

---

## Tasks

- [ ] Map every rule in `validateInquiryStatus.ts` and `resolveInquiry.ts` to a `from`/`to` side; list any that do not fit (counts, locks, version checks via `lockInquiryAtVersion.ts`) and keep them where they are
- [ ] Per-type resolve permissions from `inquiryTypes.ts` become `to.permission`, not a second check
- [ ] The deleted-party cancel (R-2026-11-17-01/02, a json-rules `categorize`) checked against `eligible`
- [ ] Tests: the existing inquiry suites pass unchanged in outcome

---

## Open Questions

- Whether per-type actions live in one resource (`db:Inquiry`) keyed by type, or a resource per type.
- Whether `approve` with the approver's adjusted copy (R-2026-11-15) is a `to` predicate or stays in the handler.

---

## Definition of Done

- [ ] Inquiry status changes go through `checkTransition`; hand-written status validators gone
- [ ] Docs (`docs/claude/INQUIRIES.md` or the inquiry section) and regions updated
- [ ] Full check green; PR for Aron; Kingdom port after review
