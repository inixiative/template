# AUTH-009 — Permission changes inside a batch

**Status:** 🆕 Not Started · **Line:** AUTH · **Priority:** Low · **Related:** #219

## Context

A batch's sub-requests share the permissions installed when the batch signed in. If an early sub-request changes what the caller holds (a role write, a member removal, a token's or integration's permissions), the later sub-requests in the same round still check against the old table.

## Direction

Don't refresh permissions mid-batch. Refuse permission-changing routes inside a batch instead: a flag on the route ("allowed in a batch"), defaulting to allowed, set to refused on routes that write roles, membership, `full` or entitlements. The batch rejects the request up front.

## Open

- Which routes carry the flag (start from the routes that call `assign`, `delete` on member rows, `validateFullGrant` or `validateEntitlementGrants`).
- Whether a refused route fails the whole batch or only its own sub-request.
