# FEAT-019: Extensible Actor Attribution (actor meta / on-behalf-of)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-07-09
**Updated**: 2026-07-09

---

## Overview

The actor primitive (ALS actor context → `AuditLog` actor block → app-event envelope) only models structured principals: `actorUserId`, `actorSpoofUserId`, `actorTokenId`, `actorJobName`, plus request metadata (`ipAddress`, `userAgent`, `originIntegration`). There is no sanctioned place to attach attribution that isn't a traditional user or token.

Real cases that don't fit today:

- **On-behalf-of for integration tokens.** A token-authenticated call from an external system (e.g. Salesforce writeback) carries no human identity, but the external system knows which human acted. Today that identity is either dropped or hand-threaded per call site.
- **Domain-role attribution.** Downstream consumers (Zealot's reference decline/cancel emails) need actor facets like "which side of the transaction acted" (advocate vs prospect) and a display email — so bespoke parallel actor shapes grow per domain (`ReferenceTransitionActorType`) and collapsing them into the shared actor is lossy.
- **Anything else non-principal**: external request ids, device context, delegated-automation identity.

Each of these currently forces either a new `AuditLog` column or a bespoke `{ actor, email }` side-channel. The fix is one extension point on the actor itself.

## Proposal

- Add a freeform extension to the actor primitive — `actorMeta Json?` (name TBD) — carried on the ALS actor scope, stamped onto every `AuditLog` row, and included on the app-event envelope actor capture.
- Setters at the seams: middleware can record sanctioned inbound headers into it (e.g. `x-acting-user-email`, name TBD) **only on token-authenticated requests**; services can enrich it inside the request scope; job context can stamp job-specific attribution.
- When an on-behalf-of email resolves to a real user in the org, optionally also set a structured field (or resolve to `actorUserId`-adjacent storage) — the meta keeps the raw claim either way.

## Contract

- **Attribution only, never authorization.** Nothing may make an allow/deny decision from `actorMeta`. It is display/audit/debug data, unverified where it comes from headers (record it as claimed, mark the source).
- Additive and optional — absence means nothing; no consumer may require it.
- Namespaced keys (`onBehalfOf.email`, `domain.referenceRole`, …) so domains don't collide.

## Tasks

- [ ] Add `actorMeta Json?` to `AuditLog` + the ALS actor context type
- [ ] Stamp it on the app-event envelope actor capture (emit-time, alongside the existing scope capture)
- [ ] Middleware: record sanctioned on-behalf-of header(s) on token-authenticated requests, tagged as unverified claims
- [ ] Decide the resolved-user behavior (meta-only vs also resolving to a structured actor field)
- [ ] Docs: contract (attribution-only), key namespacing, examples

## Open Questions

- Field name: `actorMeta` vs `actorContext` vs `onBehalfOf` + general meta split?
- Should verified resolutions (on-behalf-of email matches an org user) promote to a structured column so it's indexable?
- Does `originIntegration` fold into the meta or stay a first-class column?

## Related Tickets

- [FEAT-017: Audit Log Hardening, Lineage, and Explorer](./FEAT-017-audit-log-hardening-lineage-and-explorer.md)
- [FEAT-016: Inquiry Lineage & Nesting](./FEAT-016-inquiry-lineage-and-nesting.md)

---

## Comments

_Spawned from Zealot ZLT-3316 discussion (2026-07-09): SFDC writeback drives reference status transitions through a brand-token-authenticated endpoint, mislabelling the actor and losing the human who clicked in Salesforce; collapsing Zealot's bespoke `ReferenceTransitionActorType` into the shared `AuditActor` is lossy without a place for reference role + email. Aron's ruling: this is a general actor-primitive extension, design it in the template first, then port._
