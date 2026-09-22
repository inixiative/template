# FEAT-022: Feature Flag Inheritance — what "the platform turned it on for you" means down the provider chain

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-09-17
**Updated**: 2026-09-17

> Split out of FEAT-003 (architect, 2026-09-17). v1 flags resolve against exactly one row: a bare slug is the platform's, a `custom:` slug is its owner's. This ticket owns the question FEAT-003 deliberately left undefined: when the platform enables a flag for an organization, what does that mean for the organization's own customers and spaces, and what may the organization do about it.

---

## What FEAT-003 already fixed so this can be answered later

- Subjects are `CustomerRef`s and hops are providers, so a "path" is a chain of customer relationships (user → space → org → platform), not a chain of memberships.
- `custom:` marks rows that will never participate in a chain; bare slugs are the platform's and are the only candidates for inheritance.
- Values are typed and multi-valued. Booleans can intersect along a path; `A` / `B` / `C` cannot, so any chain semantics must separate *permission to serve* from *selection of a variant*.
- Disabled means the type's zero, never a served default, so "an ancestor refuses" has one meaning.

## Undefined, and why it stayed undefined

- **Delegation vs. provisioning.** Is the org a *subject* of the platform's flag (the platform addresses the org, full stop), or a *relay* (the org's customers see the platform's flag through the org)? The two need different rows and different reads.
- **Narrowing.** If an org may define a same-slug row, does it carry only `enabled` and a gate (literal narrowing), or its own variants (replacement, which the adversarial pass showed widens a platform rollout)? Whose default wins when a mid-path row refuses?
- **Subject alignment across hops.** A platform flag with `subjectModel: Organization` has the org's platform ref as subject; the org is not its own customer, so an org row cannot gate it. Which subject kinds can be narrowed at which hop.
- **Orphans.** When the platform deletes its row, what happens to the rows below.
- **Path choice.** A user who is the platform's customer directly *and* a member of an org that is: which hop answers which slug, and whether the UI ever shows both.
- **Invalidation of descendant contexts** when an inherited flag changes.

## Related

- **Blocked by**: FEAT-003 (v1 flags), FEAT-021 (segments, PR #105).
- **Informs**: FIN-001 / BRAND-002 §4.1 (subtenant entitlement is this chain with a subscription as the gate).
