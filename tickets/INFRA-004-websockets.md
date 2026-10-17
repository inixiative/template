# INFRA-004: WebSockets — current transport and remaining consumers

**Status**: 👀 Review — query-refetch transport and subscribe authorization implemented; feature flags and notifications remain separate consumers
**Assignee**: Aron
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-09-21

## Current implementation

- Bun WebSockets, local connection/user/channel indexes, heartbeat and Redis pub/sub.
- App-root `useApiWebsocket`, QueryClient subscription tracking and reconnect invalidation.
- Message-based authentication through the real `/me` route; spoof authority follows HTTP.
- Registered channel families in `WS_CHANNELS`; `LIVE_QUERIES` derives from that registry.
- Route-probed subscribe authorization via `canSubscribe`; unknown, malformed and unauthorized
  subscriptions are rejected. The June report of unchecked subscription is superseded.
- Identity changes clear old channel subscriptions; reconnect replays identity before channels
  and waits for acknowledgement or a bounded timeout before recovering live queries.
- App-event `WSHandoff` envelopes target channels or users. Current frontend consumers handle
  query-refetch hints, including segment-member and per-user membership updates.

The implementation and source map are documented in [WEBSOCKETS.md](../docs/claude/WEBSOCKETS.md).
Authorization is checked at subscription, not continuously on every delivery. Hints are not a
persistent event log; recovery is consumer-owned.

## Remaining work

- FEAT-003: define flag evaluation and invalidation, then connect the flag query to this transport.
- FEAT-012: persisted notifications and their API/UI. Transport availability is not notification delivery persistence.
- Any new message kind needs its own frontend handler, authorization and recovery contract.

## Verification

`apps/api/src/ws/probe.test.ts` exercises the real route's permissions, missing credentials,
unknown/malformed channels and spoofed authority. Handler, identity, lifecycle, pub/sub and
frontend socket tests cover the corresponding transport behavior.

## Related tickets

- [FEAT-003: Feature Flags](FEAT-003-feature-flags.md)
- [FEAT-012: Notifications](FEAT-012-notifications.md)
- [FEAT-021: Segments](FEAT-021-segments.md)

The former `useAppEvents`, token-query-string and `registerAppEvent` examples were planning
sketches. Use the current source and documentation above for new integrations.
