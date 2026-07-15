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
- Setters at the seams: middleware records the inbound generic header (below); services can enrich it inside the request scope; job context can stamp job-specific attribution.
- When an on-behalf-of email resolves to a real user in the org, also resolve to a structured actor field so it's indexable — the meta keeps the raw claim either way.

## Generic header pattern (ruling 2026-07-09)

One generic header, not per-purpose headers, so external callers can attach arbitrary attribution:

- **`x-actor-meta`**, RFC 8941 structured-field dictionary syntax — `x-actor-meta: onbehalfof.email="jane@acme.com", source.system="salesforce", source.userid="005xx000001"`. Do NOT invent a custom delimiter grammar (colon-separated etc.) — hand-rolled wire formats grow escaping bugs; 8941 has defined quoting and off-the-shelf parsers.
- **Namespaced lowercase dotted keys, arbitrary keys accepted** — the point is generic capture of extra attribution without schema churn.
- **Well-known-key registry** (`onbehalfof.email`, `source.system`, `source.userid`, …) gets promoted behavior (e.g. resolve on-behalf-of email to a real user). Unknown keys ride along as claims.
- **Claims envelope**: header-sourced values land under `actorMeta.claimed` with the source recorded (`{ claimed: {...}, source: 'x-actor-meta' }`) so server-derived facts and caller-asserted claims are never confusable. Explicitly unverified/unenforced by design.
- **Caps + no silent drops**: size cap (~2KB) and per-key validation; log/count anything dropped rather than silently eating it.
- **Token-authenticated requests only** to start (that's where the identity gap is); widening to user-JWT requests is a later decision if a use case appears.

## Contract

- **Attribution only, never authorization.** Nothing may make an allow/deny decision from `actorMeta`. It is display/audit/debug data, unverified where it comes from headers (record it as claimed, mark the source).
- Additive and optional — absence means nothing; no consumer may require it.
- Namespaced keys (`onBehalfOf.email`, `domain.referenceRole`, …) so domains don't collide.

## Tasks

- [ ] Add `actorMeta Json?` to `AuditLog` + the ALS actor context type
- [ ] Stamp it on the app-event envelope actor capture (emit-time, alongside the existing scope capture)
- [ ] Middleware: parse `x-actor-meta` (RFC 8941 dictionary) on token-authenticated requests into `actorMeta.claimed`
- [ ] Well-known-key registry + promotion (on-behalf-of email → resolved structured actor field)
- [ ] Docs: contract (attribution-only), key namespacing, header syntax, examples

## Open Questions

- Field name: `actorMeta` vs `actorContext` vs `onBehalfOf` + general meta split?
- Does `originIntegration` fold into the meta or stay a first-class column?
- Should user-JWT requests ever be allowed to send `x-actor-meta` (admin acting "as" a workflow), or token-only forever?

## Related Tickets

- [FEAT-017: Audit Log Hardening, Lineage, and Explorer](./FEAT-017-audit-log-hardening-lineage-and-explorer.md)
- [FEAT-016: Inquiry Lineage & Nesting](./FEAT-016-inquiry-lineage-and-nesting.md)

---

## Comments

_Spawned from Zealot ZLT-3316 discussion (2026-07-09): SFDC writeback drives reference status transitions through a brand-token-authenticated endpoint, mislabelling the actor and losing the human who clicked in Salesforce; collapsing Zealot's bespoke `ReferenceTransitionActorType` into the shared `AuditActor` is lossy without a place for reference role + email. Aron's ruling: this is a general actor-primitive extension, design it in the template first, then port._
