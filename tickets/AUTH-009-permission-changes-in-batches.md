# AUTH-009 — Permission changes inside a batch

**Status:** Mechanism done (#214), routes open · **Line:** AUTH · **Priority:** Low · **Related:** #219, #214

## Context

A batch's sub-requests share the permissions installed when the batch signed in. If an early sub-request changes what the caller holds (a role write, a member removal, a token's or integration's permissions), the later sub-requests in the same round still check against the old table.

## Direction

Don't refresh permissions mid-batch. Refuse permission-changing routes inside a batch instead: a flag on the route ("allowed in a batch"), defaulting to allowed, set to refused on routes that write roles, membership, `full` or entitlements. The batch rejects the request up front.

## Built (#214)

- The flag is the OpenAPI operation extension `'x-batch': false` on the route's args, so it shows in the published doc. Routes are batchable unless they say otherwise.
- `assertBatchable` (`apps/api/src/modules/batch/services/assertBatchable.ts`) scans every request of every round against the app's OpenAPI registry before anything runs. One match refuses **the whole batch** with a 400. An interpolated segment (`<<…>>`) counts as matching any route below it.
- Refused today: `POST /api/v1/me/changePassword`, `POST /api/v1/me/rotateJwts`, and every Better Auth endpoint (`/api/auth/*`, any method; they never reach the registry). Docs: BATCH.md § Routes That Cannot Batch.

## Open

- Which permission-changing routes carry the flag (start from the routes that call `assign`, `delete` on member rows, `validateFullGrant` or `validateEntitlementGrants`). Token and membership routes were deferred (Aron, 2026-10-26).
