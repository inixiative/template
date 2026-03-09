# FEAT-017: Audit Log Hardening, Inquiry Lineage, and Explorer

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-03-08
**Updated**: 2026-03-08

---

## Overview

Follow-up work after the first audit log PR lands. This ticket covers the changes needed to make audit logs durable enough for both operational history and compliance/security use, while also improving inquiry lineage and admin querying.

## Objectives

- [ ] Harden audit capture for real transactional durability
- [ ] Separate audit subject identity from org/space context
- [ ] Link inquiry-driven mutations directly into the audit chain
- [ ] Add a usable admin audit explorer with pagination and filtering
- [ ] Define the handoff to retention and cold-storage follow-up work

---

## Tasks

### Audit Data Model

- [ ] Split `contextOrganizationId` / `contextSpaceId` from subject FK fields on `AuditLog`
- [ ] Add explicit `subjectOrganizationId` / `subjectSpaceId` where needed
- [ ] Remove cascade semantics from audit relations so audit rows can outlive deleted subjects
- [ ] Review whether some audit references should be plain scalar IDs instead of relational FKs

### Audit Capture Semantics

- [ ] Move audit writes into the mutation transaction instead of `db.onCommit()`
- [ ] Detect soft deletes (`deletedAt: null -> timestamp`) and record them as `delete`
- [ ] Keep `update` semantics for restore/nullification until a dedicated restore action is introduced
- [ ] Keep `AuditLog` explicitly excluded from audit hooks to avoid recursion

### Registry and Source of Truth Cleanup

- [ ] Replace `MODEL_TO_SUBJECT_FK` with logic derived from the false-polymorphism registry
- [ ] Keep only the minimal record-field remapping needed for composite subjects
- [ ] Narrow `AUDIT_ENABLED_MODELS` to the first-pass high-signal model set

### Inquiry Lineage

- [ ] Add `sourceInquiryId` or equivalent causal linkage to audit rows
- [ ] Thread inquiry resolution context through async storage so audit hooks can read it
- [ ] Preserve resolver identity as the audit actor while separately recording inquiry causality
- [ ] Expose audit log includes on inquiry reads where useful

### Admin Explorer

- [ ] Replace the fixed `take: 100` audit read with `paginate()`
- [ ] Support bracket-query filtering and explicit searchable/orderable fields
- [ ] Add useful default indexes for actor, subject, context, and created-at queries
- [ ] Review the admin audit router/module wiring for consistency with repo conventions

### Follow-Up Handshake

- [ ] Confirm retention/cold-storage ownership with `INFRA-007` and `INFRA-009`
- [ ] Define the minimum event taxonomy needed for audit browsing and export
- [ ] Decide what belongs in this ticket vs a dedicated audit UI follow-up

---

## Open Questions

- Should audit references prefer nullable relations or scalar-only IDs for long-term retention?
- Do we want a dedicated `restore` audit action later, or keep restore as `update`?
- Which model set is the right first-pass allowlist for high-signal audit capture?

---

## Implementation Notes

- Current implementation captures actor context with async local storage and writes logs after commit. That is convenient but leaves audit gaps if audit insertion fails after the business mutation commits.
- Inquiry resolution should keep the resolver as `actor`, but should also stamp the causal inquiry onto the audit row so the chain is queryable.
- Cold storage/export should build on durable hot audit rows rather than replace them.

---

## Definition of Done

- [ ] Audit rows are durable with the mutation
- [ ] Audit rows survive subject deletion
- [ ] Soft deletes appear as delete events
- [ ] Inquiry-driven changes link back to their source inquiry
- [ ] Admin audit reads support pagination and filtering
- [ ] Related docs/tickets updated

---

## Resources

- [FEAT-005: Audit Logs](./FEAT-005-audit-logs.md)
- [INFRA-007: Data Lifecycle](./INFRA-007-data-lifecycle-retention-export-delete.md)
- [INFRA-009: Audit Log Cold Storage](./INFRA-009-audit-logs-cold-storage.md)
- [FEAT-016: Inquiry Lineage & Nesting](./FEAT-016-inquiry-lineage-and-nesting.md)

---

## Related Tickets

- [FEAT-005: Audit Logs](./FEAT-005-audit-logs.md)
- [FEAT-016: Inquiry Lineage & Nesting](./FEAT-016-inquiry-lineage-and-nesting.md)
- [INFRA-007: Data Lifecycle](./INFRA-007-data-lifecycle-retention-export-delete.md)
- [INFRA-009: Audit Log Cold Storage](./INFRA-009-audit-logs-cold-storage.md)

---

## Comments

_Spawned from PR review follow-up after initial audit log implementation._
