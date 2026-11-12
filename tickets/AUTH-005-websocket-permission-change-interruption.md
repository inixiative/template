# AUTH-005: Interrupt WebSocket subscriptions on permission changes

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Low
**Created**: 2026-09-27
**Updated**: 2026-09-27

## Overview

The contacts stream is scaffolding for exercising the stream primitive. Permission-change interruption is deferred by the owner and does not block the current Template sync. Before a real permission-sensitive consumer uses streams, connect committed authorization changes to the existing app-event and WebSocket infrastructure.

## Definition of Done

- [ ] Relevant membership, role, session, and token mutations invalidate affected subscriptions after commit; rollbacks do not.
- [ ] Invalidation reaches all socket-holding instances, including mutations originating in workers.
- [ ] Revoked subscriptions stop receiving payloads; re-open checks current route authorization.
- [ ] Tests use real mutations with cache and invalidation hooks registered, including multi-instance delivery and an open/revoke race.
- [ ] Document authorization lifetime and any remaining delivery window.

## Coordination

- [GitHub issue #126](https://github.com/inixiative/template/issues/126) is the external tracker.
- [Unmerged PR #124](https://github.com/inixiative/template/pull/124) adds periodic reauthorization and credential-change cleanup. Coordinate with that work; event-driven interruption remains separate.
- Main at `337ae572` clears authorization cache entries but does not interrupt existing streams. The review reproduction was a controlled lifecycle probe, not a production membership-removal test.
