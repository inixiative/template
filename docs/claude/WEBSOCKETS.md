# WebSockets — realtime query refetch and data streams

<!-- toc:start -->

## Contents

- [Contract](#contract)
- [Channel registry and authorization](#channel-registry-and-authorization)
- [Connection and recovery](#connection-and-recovery)
- [Publishing a refetch](#publishing-a-refetch)
- [Data streams](#data-streams)
- [Frontend and horizontal scaling](#frontend-and-horizontal-scaling)
- [Source and verification](#source-and-verification)

<!-- toc:end -->

## Contract

The frontend consumes two event classes (`WSEvent`, dispatched as `handlers[category][action]`):

- **Query-refetch hints** — `{ category: 'query', action: 'refetch', key: { _id, path? } }`. The
  client invalidates that TanStack Query key and fetches data through the normal authorized HTTP
  route. Reconnect recovery refetches registered live queries.
- **Data streams** — `{ category: 'data', action: 'snapshot' | 'append', stream, payload }`. The
  socket carries the data itself: a snapshot per open, then pushed appends. See
  [Data streams](#data-streams).

Neither class is persisted or replayed. An app-event handler returns `WSHandoff[]`, whose envelope
separates the target (`{ channels }`, `{ userIds }` or `{ streams }`) from `message.data`. Any
further payload type needs its own authorization, frontend handling and recovery behavior, as
the data-stream class defines below.

## Channel registry and authorization

`packages/shared/src/ws/channels.ts` exports `WS_CHANNELS`. Each family is typed `query` (a
refetch channel) or `stream` (a data stream). `LIVE_QUERIES` is derived from its query entries;
edit the registry rather than maintaining a second list. Registered query families are
`inquiryRead` and `segmentReadManySegmentMembers`; the registered stream family is
`organizationReadManyContacts`.

`channelKey({ _id, path })` retains operation identity and path parameters, dropping query,
headers and body. A list channel therefore covers all query-filter variants of that path.

A subscription is authorized by the underlying HTTP route. `canSubscribe` in
`apps/api/src/ws/probe.ts` rejects unknown families and stream families (`resolveChannelRoute`),
resolves the operation from OpenAPI, checks its path parameters, then probes the route with the
socket's sanitized credentials.
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

## Data streams

A data stream is a live view of one route's default response. The stream name is the channel key of
that route (`WS_CHANNELS.organizationReadManyContacts.name(organizationId)` →
`organizationReadManyContacts:id:<organizationId>`), so the route it stands for is explicit. Only
canonical names are accepted: a name must equal `channelKey(parseChannelKey(name))`.

```
client → { action: 'open', stream }       server → { type: 'opened', stream }
server → { category: 'data', action: 'snapshot', stream, payload }
server → { category: 'data', action: 'append',   stream, payload } …
client → { action: 'close', stream }      server → { type: 'closed', stream }
unknown or unauthorized open → { type: 'openRejected', stream }
```

Closing the socket or changing identity closes every stream on it. There are no sequence
numbers and no replay.

**Authorization and snapshot.** `openDataStream` (`apps/api/src/ws/dataStreams.ts`) resolves the
stream to its route with `resolveChannelRoute`, which requires a registered `stream` family and a
`GET` operation, and requests that route in-process with the connection's credential
(`fetchStreamSnapshot`). This is not a probe: the route runs, and a 2xx response both grants the
open and becomes the snapshot. Its `payload` is exactly the route's response body with no query
string, so a paginated route snapshots its first page at the default page size. Any other
status sends `openRejected`. An exception while opening sends `{ type: 'error', action: 'open',
stream }`. Authorization runs per open, like `canSubscribe`; appends are not
re-authorized per message. Two rules follow for every stream family:

- The route's result must be the same for every caller it admits. Appends go to every connection
  holding the stream name, so a route that filters rows per caller cannot be a stream.
- Append payloads must be shaped exactly as the route serializes them (the contacts producer
  parses through `ContactScalarSchema`, the route's response schema), so an append never carries
  more than the snapshot would.

A caller who loses access keeps an already-open stream until it closes, the socket reconnects,
or the connection's identity changes. Each of those re-authorizes. Because streams carry data
rather than hints, this window is a real exposure; it is an open design question, not a settled
property. Superadmin and spoofed callers are the one deliberate exception to "same result for
every caller" (superadmin list reads include soft-deleted rows).

**Ordering.** The connection subscribes to the stream before the snapshot request. Appends that
arrive during the request are held (`heldAppends`) and sent after the snapshot, so a client never
sees an append before its snapshot. Because an append can repeat a change the snapshot already
contains, every append reducer must be idempotent.

**Producing appends.** Appends are app-event output, like refetch hints. A handler returns a
`{ streams }` handoff whose `message.data` is the append payload; `deliverWSHandoffs` calls
`appendToStream`, which wraps it in the data frame and publishes through Redis:

```typescript
websocket: ({ contact }) => organizationContactsHandoffs(contact, contactUpsertAppend(contact)),
```

`organizationContactsHandoffs` returns `[{ target: { streams: [<org stream>] }, message: { data:
{ upsert: contactRow } } }]`, or `null` for a contact no organization owns.

List streams use `ListStreamAppend<T>` (`{ upsert: row } | { remove: id }`). The
`contact.created`, `contact.updated` and `contact.deleted` handlers publish to the owning
organization's stream.

**Frontend handling.** A consumer reads a stream through a TanStack query keyed
`dataStreamQueryKey(stream)`: `useDataStream<TSnapshot>(stream)`, or the example
`useOrganizationContactsStream(organizationId)`. The query has no `queryFn`. The client slice's
query-cache listener opens the stream when the first observer mounts and closes it when the last
unmounts. `createApiWebsocket` refcounts open streams, the same way it refcounts channels.
`dispatchMessage` writes a snapshot with `setQueryData` and folds an append into it with the
family's reducer from `DATA_STREAM_REDUCERS` (`packages/ui/src/lib/ws/dataStreamReducers.ts`,
typed so that every stream family must have one). `reduceListStream` keeps rows in the list routes' default `id desc` order: an upsert replaces a
held row (unless its `updatedAt` is older), inserts a row that belongs among the loaded rows, and
ignores one beyond the loaded page. A remove drops a held row. `pagination.total` moves with
inserts and removes of loaded rows, so it is approximate once rows outside the page change.
Appends from concurrent writers are applied in arrival order; the `updatedAt` guard stops a
stale update from overwriting a newer one, but a late upsert can still re-add a row removed
just before it.

`openRejected` puts the stream's query in the error state with no data; the stream stays held
(the holder count is kept) but is not replayed until a new holder mounts or the identity changes.
An `error` frame for an open also puts the query in the error state; that stream stays held and
is retried on the next connection. Each open is counted until its answer arrives, so a rejection
answering an open that a later open superseded is ignored. Frames for a stream the client no
longer holds, or that was rejected, are ignored.

**Recovery.** `open` frames go out only on a live connection. On (re)connect they are sent from
`onOpen`, after the identity frame; on an identity change they follow the new identity frame. The server re-authorizes each one and answers
with a fresh snapshot that replaces the cached data. Appends published while the client was
disconnected are covered by that snapshot, not replayed.

## Frontend and horizontal scaling

`useApiWebsocket()` is mounted at each app root. The client slice's query-cache listener subscribes
and unsubscribes mounted queries gated by `LIVE_QUERIES`; `setClient` wires the QueryClient and
reconnect recovery. `dispatchMessage` handles `query.refetch` with query-prefix invalidation.

`sendToChannel`, `sendToUser`, `appendToStream` and `broadcast` publish through Redis
`ws:broadcast`. Each API instance delivers to its local registry. Stream snapshots are served
by whichever instance holds the socket; appends reach streams open on any instance. Redis failure falls back to local delivery, so
cross-instance delivery is unavailable during the outage.

## Source and verification

- `packages/shared/src/ws/`: events, channel keys, registry and browser transport.
- `packages/ui/src/lib/ws/`: API socket, acknowledgement/reconnect handling and dispatch.
- `apps/api/src/ws/`: handler, identity, probe, data streams, registries, delivery and Redis pub/sub.
- `apps/api/src/ws/probe.test.ts`: real-route authorization, unknown channels, missing credentials
  and spoof authority.
- `apps/api/src/ws/handler.test.ts`, `packages/ui/src/lib/ws/createApiWebsocket.test.ts`: protocol behavior.
- `apps/api/src/ws/dataStreams.test.ts`: stream authorization against the real route, snapshot,
  held appends, close and identity change.
- `apps/api/src/appEvents/handlers/contact/organizationContactsStream.test.ts`: app event →
  Redis → open socket, with append rows matching the route snapshot.
- `packages/ui/src/hooks/useOrganizationContactsStream.test.tsx`: consumer hook states.

See [APP_EVENTS.md](APP_EVENTS.md) and [Segments](SEGMENTS.md#events-and-email-integration).
