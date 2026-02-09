# INFRA-006: Tenant Isolation Test Matrix

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-02-07
**Updated**: 2026-02-07

---

## Overview

Create a dedicated, explicit test matrix to prove cross-tenant isolation across all auth modes:
- session user
- org/space tokens
- spoofed superadmin context

The project has strong permission primitives, but enterprise readiness requires isolation proof as a first-class artifact.

## Scope

- Organization and space boundaries
- Token scope boundaries (ownerModel variants)
- Search/pagination/filter routes (no data leakage)
- Webhook subscription visibility boundaries

## Tasks

- [ ] Define isolation invariants (what must never be accessible)
- [ ] Build reusable fixtures for multi-org, multi-space scenarios
- [ ] Add route-level isolation tests for core modules (`me`, `organization`, `space`, `token`, `webhookSubscription`)
- [ ] Add regression tests for known bypass vectors (searchFields/orderBy/bracket notation)
- [ ] Add docs section: "Isolation Guarantees and Limitations"

## Definition of Done

- [ ] Isolation matrix documented and test-backed
- [ ] Critical routes have explicit deny-path tests
- [ ] Test output can be linked during security/compliance reviews

## Related Tickets

- FEAT-008 (Permissions builder)
- AUTH-001 (SSO)
- FEAT-005 (Audit logs)

