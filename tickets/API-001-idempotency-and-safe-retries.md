# API-001: Idempotency and Safe Retries

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-02-07
**Updated**: 2026-02-07

---

## Overview

Add idempotency guarantees for mutation endpoints so client/network retries cannot create duplicate side effects.

This is critical for enterprise integrations and aligns with existing job dedupe/cancellation patterns.

## Scope

- API write endpoints (`POST`, selected action routes)
- Idempotency key contract (header + TTL + conflict behavior)
- Response replay for duplicate keys
- Interaction with mutation hooks, webhooks, and jobs

## Tasks

- [ ] Define idempotency contract (`Idempotency-Key`, scope keying, expiration)
- [ ] Implement persistence model/storage for idempotency records
- [ ] Implement middleware/controller integration for write routes
- [ ] Ensure webhook/job side effects are not duplicated on replay
- [ ] Add tests:
  - [ ] same key + same payload returns same result
  - [ ] same key + different payload returns conflict
  - [ ] concurrent duplicate requests are safe
- [ ] Document behavior in API docs

## Definition of Done

- [ ] At least one core mutation route proves idempotent behavior
- [ ] Contract documented with examples and error semantics
- [ ] No duplicate DB rows/jobs/webhook events from retry scenarios

## Related Tickets

- INFRA-003 (CI/CD baseline checks)
- INFRA-004 (WebSockets)
- FEAT-005 (Audit logs)

