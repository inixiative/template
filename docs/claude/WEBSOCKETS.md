# WebSockets — realtime query refetch

<!-- toc:start -->

## Contents

- [Contract](#contract)
- [Channel registry and authorization](#channel-registry-and-authorization)
- [Connection and recovery](#connection-and-recovery)
- [Publishing a refetch](#publishing-a-refetch)
- [Frontend and horizontal scaling](#frontend-and-horizontal-scaling)
- [Source and verification](#source-and-verification)

<!-- toc:end -->

## Contract

The frontend currently consumes query-refetch hints:
`{ category: 'query', action: 'refetch', key: { _id, path? } }` (`WSEvent`). The client
invalidates that TanStack Query key and fetches data through the normal authorized HTTP route.
Hints are not persisted or replayed; reconnect recovery refetches registered live queries.

An app-event handler returns `WSHandoff[]`, whose envelope separates the target
(`{ channels: string[] }` or `{ userIds: string[] }`) from `message.data`. The envelope allows
arbitrary payloads, but the current frontend dispatcher only handles query refetches. A future
payload type needs its own authorization, frontend handling and recovery behavior.

## Channel registry and authorization

`packages/shared/src/ws/channels.ts` exports `WS_CHANNELS`. `LIVE_QUERIES` is derived from its
query entries; edit the registry rather than maintaining a second list. Registered families
are `inquiryRead` and `segmentReadManySegmentMembers`.

`channelKey({ _id, path })` retains operation identity and path parameters, dropping query,
headers and body. A list channel therefore covers all query-filter variants of that path.

A subscription is authorized by the underlying HTTP route. `canSubscribe` in
`apps/api/src/ws/probe.ts` rejects unknown families, resolves the operation from OpenAPI,
checks its path parameters, then probes the route with the socket's sanitized credentials.
Only a successful response grants the subscription. The server sends `subscribed` or
`subscribeRejected`; the frontend removes rejected channels from its desired set.

This check runs on subscription. Existing channels are cleared when the effective user ID
changes. Do not infer continuous per-message permission revalidation from this mechanism.

## Connection and recovery

The WebSocket upgrade starts anonymous; credentials are sent in an `authenticate` frame,
not a token query parameter. Only `authorization` and `x-spoof-user-email` headers cross into
the identity probe. `/api/v1/me` resolves the effective identity through normal auth/spoof
middleware. Spoof and unspoof are frontend operations that send new authenticate frames;
`logout` clears identity and credentials.

Frames are serialized per connection. The handler bounds the pending queue and frame rate.
The frontend sends a heartbeat every 30 seconds and reconnects if pong does not arrive within
5 seconds; the server sweeps connections idle for more than 5 minutes.

On reconnect, `createApiWebsocket` sends identity before replaying its refcounted channel set.
It waits for subscription acknowledgements (or the bounded acknowledgement timeout) before
calling the reconnect callback that invalidates live queries. Shutdown closes connections;
missed hints are recovered by refetch, not by guaranteed delivery of every event.

## Publishing a refetch

Register a channel family in `WS_CHANNELS` and return a handoff from a business-event handler:

```typescript
websocket: (data) => [{
  target: { channels: [WS_CHANNELS.segmentReadManySegmentMembers.name(data.segmentId)] },
  message: { data: refetch({ _id: 'segmentReadManySegmentMembers', path: { id: data.segmentId } }) },
}],
```

`makeAppEvent` calls `deliverWSHandoffs`, which publishes to channels or user IDs. User-targeted
membership changes instead send `meReadManySegmentMemberships` refetches to the affected User's
sockets; those sends do not require adding that operation to the channel registry.

## Frontend and horizontal scaling

`useApiWebsocket()` is mounted at each app root. The client slice's query-cache listener subscribes
and unsubscribes mounted queries gated by `LIVE_QUERIES`; `setClient` wires the QueryClient and
reconnect recovery. `dispatchMessage` handles `query.refetch` with query-prefix invalidation.

`sendToChannel`, `sendToUser` and `broadcast` publish through Redis `ws:broadcast`. Each API
instance delivers to its local registry. Redis failure falls back to local delivery, so
cross-instance delivery is unavailable during the outage.

## Source and verification

- `packages/shared/src/ws/`: events, channel keys, registry and browser transport.
- `packages/ui/src/lib/ws/`: API socket, acknowledgement/reconnect handling and dispatch.
- `apps/api/src/ws/`: handler, identity, probe, registries, delivery and Redis pub/sub.
- `apps/api/src/ws/probe.test.ts`: real-route authorization, unknown channels, missing credentials
  and spoof authority.
- `apps/api/src/ws/handler.test.ts`, `packages/ui/src/lib/ws/createApiWebsocket.test.ts`: protocol behavior.

See [APP_EVENTS.md](APP_EVENTS.md) and [Segments](SEGMENTS.md#events-and-email-integration).
