# WebSockets — realtime query refetch and data streams

<!-- toc:start -->

## Contents

- [Contract](#contract)
- [Channels vs streams: when to use which](#channels-vs-streams-when-to-use-which)
- [Channel registry and authorization](#channel-registry-and-authorization)
- [Connection and recovery](#connection-and-recovery)
- [Publishing a refetch](#publishing-a-refetch)
- [Data streams](#data-streams)
  - [Stream definitions](#stream-definitions)
  - [Audience](#audience)
  - [Authorization and re-authorization](#authorization-and-re-authorization)
  - [Ordering](#ordering)
  - [Producing appends](#producing-appends)
  - [Frontend](#frontend)
- [Frontend and horizontal scaling](#frontend-and-horizontal-scaling)
- [Source and verification](#source-and-verification)

<!-- toc:end -->

## Contract

The frontend consumes two event classes (`WSEvent`, dispatched as `handlers[category][action]`):

- **Query-refetch hints** — `{ category: 'query', action: 'refetch', key: { _id, path? } }`. The
  client invalidates that TanStack Query key and fetches data through the normal authorized HTTP
  route. Reconnect recovery refetches registered live queries.
- **Data streams** — `{ category: 'data', action: 'snapshot', stream, payload }` once per open,
  then `{ category: 'data', action: 'append', stream, type, payload }` for each change. The socket
  carries the data itself, and every frame is validated against a shared, typed stream definition
  on both ends. See [Data streams](#data-streams).

Neither class is persisted or replayed. Every consumer owns a recovery path that does not depend
on the push: query channels refetch on reconnect, and data streams re-open for a fresh snapshot.

An app-event handler returns `WSHandoff[]`: a message handoff (`{ channels }` or `{ userIds }`
target plus `message.data`) or a stream handoff built by `streamAppend`. Any further payload type
needs its own authorization, frontend handling and recovery behavior.

## Channels vs streams: when to use which

**Channels are the default.** A channel carries only a hint ("this query changed"); the client
refetches through the ordinary HTTP route, so authorization, filtering, pagination and response
shaping all stay where they already are, and per-caller differences cost nothing. A missed hint
is repaired by the reconnect refetch.

Reach for a **stream** only when the data is genuinely incremental and high-frequency, so that
refetching the whole resource on every change would be wasteful or too slow: streaming model
output token by token, a live activity feed, a progress log. A stream carries the rows
themselves, which makes the server responsible for everything a refetch gets for free: each
append is authorized for every holder, shaped exactly like the route's response, ordered against
other writers, and folded by a client reducer. If a refetch per change is affordable, use a
channel.

## Channel registry and authorization

`packages/shared/src/ws/channels.ts` exports `WS_CHANNELS`, the query-channel registry;
`LIVE_QUERIES` is derived from its keys. Registered query families are `inquiryRead` and
`segmentReadManySegmentMembers`. Stream families are not channels; they live in the stream
registry (see [Stream definitions](#stream-definitions)).

`channelKey({ _id, path })` retains operation identity and path parameters, dropping query,
headers and body. A list channel therefore covers all query-filter variants of that path.

A subscription is authorized by the underlying HTTP route. `canSubscribe` in
`apps/api/src/ws/probe.ts` resolves the name with `resolveOperationRoute`
(`apps/api/src/ws/operationRoute.ts`), which requires a canonical name
(`channelKey(parseChannelKey(name)) === name`), fills the operation's path parameters and rejects
`.` and `..` values so a name can never normalize onto a different route. It then probes the
route with the socket's sanitized credentials. Only a 2xx grants the subscription. The server
sends `subscribed` or `subscribeRejected`; the frontend removes rejected channels from its
desired set.

Channels are authorized on subscribe and dropped whenever the connection's user or credential
changes. They carry hints, not data, so they are not re-authorized per message.

## Connection and recovery

The WebSocket upgrade starts anonymous; credentials are sent in an `authenticate` frame, not a
token query parameter. Only `authorization` and `x-spoof-user-email` headers cross into the
identity probe. `/api/v1/me` resolves the effective identity through normal auth/spoof
middleware. Spoof and unspoof are frontend operations that send new authenticate frames; `logout`
clears identity and credentials. A 429 or 5xx from `/me` is not treated as "no user": the server
keeps the current identity and grants and answers `{ type: 'error', action: 'authenticate',
retryable: true }`, and the client re-sends its identity with exponential backoff. Changing the user **or** the credential (for the same user, say
a narrower token) drops every channel and stream on the connection; re-sending the identical
credential keeps them.

Frames are serialized per connection. The server bounds the pending queue
(`WS_MAX_PENDING_FRAMES`) and the frame rate (`WS_FRAME_LIMIT` per `WS_FRAME_WINDOW_MS`, shared
constants in `packages/shared/src/ws/frameLimits.ts`). A frame arriving while the queue is full is
not dropped silently: the server answers
`{ type: 'error', action, stream?, channel?, retryable: true }`. The frontend sends a heartbeat
every 30 seconds and reconnects if pong does not arrive within 5 seconds; the server sweeps
connections idle for more than 5 minutes.

On reconnect, `createApiWebsocket` sends identity first, then replays subscribes, then opens. The
replay goes through a pacer (`packages/ui/src/lib/ws/framePacer.ts`) that keeps at most 8
subscribes, opens, unsubscribes and closes unanswered and at most 10 per second, so a reconnect with many streams stays
inside both the server's pending-frame cap and the HTTP rate limit that snapshot reads and
subscribe probes count against. It waits for subscription acknowledgements (or the bounded
acknowledgement timeout) before calling the reconnect callback that invalidates live queries. A
close or unsubscribe goes out only when its open or subscribe actually reached the server, and
one the server drops for load is re-sent while the stream or channel stays released.

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

A data stream is a live view of one route's default response. Its name is the channel key of
that route (`organizationContactsStream.name({ id })` →
`organizationReadManyContacts:id:<organizationId>`), so the route it stands for is explicit.

```
client → { action: 'open', stream }        server → { type: 'opened', stream }
server → { category: 'data', action: 'snapshot', stream, payload }
server → { category: 'data', action: 'append', stream, type, payload } …
client → { action: 'close', stream }       server → { type: 'closed', stream }
unauthorized (401/403/404/400…) → { type: 'openRejected', stream }
transient (429/5xx), full queue, exception → { type: 'error', action: 'open', stream, retryable: true }
```

Closing the socket or changing the user or credential closes every stream on it. There is no
replay.

**The contacts stream is scaffolding.** `organizationContactsStream` exists to exercise the
primitive end to end and is the only registered stream. Remove it (definition, producers in the
contact handlers, `useOrganizationContactsStream`, and their tests) once a real stream consumer
lands. Streaming model output is the canonical first real use.

### Stream definitions

A stream is declared once, in shared code both ends import, with `defineStream`
(`packages/shared/src/ws/defineStream.ts`):

```typescript
export const organizationContactsStream = defineStream('organizationReadManyContacts', {
  audience: 'shared',
  params: z.object({ id: z.string() }),
  ...listStreamSchemas(jsonWireSchema(ContactScalarSchema)),
});
```

- `family` is the route's operationId.
- `params` is the zod schema of the route's path parameters; `name(params)` builds the stream name.
- `snapshot` is the zod schema of the route's response on the wire.
- `actions` maps each action type to the zod schema of its payload.
- `audience` is required: `'shared'` or `'perRecipient'` (see [Audience](#audience)).

Definitions live in `packages/db/src/streams/` (exported as `@template/db/streams`) because they
are built from the generated model schemas, which `packages/shared` cannot import;
`STREAM_DEFINITIONS` there is the stream registry the server resolves names against.
`jsonWireSchema` turns a model schema's `Date` fields into ISO strings (what JSON carries) and
drops strictness so a newer server field never fails an older client. `listStreamSchemas(row)`
provides the list shape: a `{ data, pagination? }` snapshot and the actions
`upsert: row` and `remove: { id, updatedAt }`.

### Audience

A `'shared'` stream promises that every authorized caller gets identical data, because its
appends fan out to every holder without regard to who they are. The promise is enforced, not
just documented:

- `apps/api/src/ws/streamAudience.test.ts` iterates `STREAM_DEFINITIONS`. For each family it
  fails if a `'shared'` stream's route carries a per-request lens scope (`scopeNarrowing`
  middleware, detected with `isPerCallerScope`), and it runs `expectStreamAudience`
  (`apps/api/tests/expectStreamAudience.ts`) with a fixture of differently privileged callers
  (owner, admin, member, viewer for contacts), failing if their snapshots differ. The fixture map
  is typed over every family, so registering a stream without a fixture is a type error.
- The same test proves the check bites: a `'shared'` definition over the per-caller
  `meReadManyContacts` route fails, and passes once declared `'perRecipient'`.

A `'perRecipient'` stream opts out: `streamAppend` then requires the recipient `userIds`, and
delivery skips every holder whose user is not listed (anonymous holders included). Superadmin and
spoofed callers remain the one deliberate exception to "identical data": superadmin list reads
include soft-deleted rows.

### Authorization and re-authorization

`openDataStream` (`apps/api/src/ws/dataStreams.ts`) resolves the name with `resolveStreamRoute`,
which requires a registered stream family and a `GET` operation, and requests that route
in-process with the connection's credential (`fetchStreamSnapshot`). This is not a probe: the
route runs, and a 2xx response both grants the open and becomes the snapshot (the route's
response body with no query string, so a paginated route snapshots its first page at the
default page size). `routeAccessOf` classifies every other status: 429 and 5xx are
**retryable** and answer `error` with `retryable: true`; anything else is a **rejection** and
answers `openRejected`.

Open streams are re-authorized. `startStreamReauthorizeSweep` (started at API boot) re-probes
every open stream every 45 seconds through the cheap `x-auth-probe` path (middleware runs, the
controller does not) with the connection's credential. A rejection closes the stream with
`openRejected`; a retryable status closes it with a retryable `error`. The sweep runs on each
connection's serialized queue and never queues a second recheck behind an unfinished one. Its
probes carry a server-only system probe secret that the API rate limiter exempts, so the sweep
spends no caller's or organization's HTTP budget; client-driven opens and subscribes still count.
A spoofed connection also re-resolves `/me` on each sweep: once the spoof no longer resolves to
the spoofed user (the caller lost superadmin, or the target is gone), every stream on it is
closed with `openRejected`, because the stream probe alone would silently run as the caller. A
probe that throws closes its stream as retryable and the sweep continues with the rest.

Revocation is therefore bounded by the sweep interval (plus the HTTP layer's own caches: the
route answers 403 only once the membership/token cache is cleared). Closing streams immediately
on membership, role or token removal through an app event is a planned follow-up.

### Ordering

The connection subscribes to the stream before the snapshot request. Appends that arrive during
the request are held (`heldAppends`) and sent after the snapshot, so a client never sees an append
before its snapshot. An append can repeat a change the snapshot already contains, so every
reducer must be idempotent.

Within one API instance, `appendToStream` publishes through a `createSerializedQueue` per stream
key (`apps/api/src/ws/streamPublishOrder.ts`): a stream's appends go out in the order the instance
emitted them, including when a publish fails and falls back to local delivery. Across instances,
Redis pub/sub is the ordering boundary: two instances publishing to the same stream are delivered
in the order Redis received the publishes, which need not be the order their writes committed.

That gap is closed per row by the payloads, not by a second ordering system: upserts carry the
row's `updatedAt`, and removals carry the removed row's `updatedAt` (its last write, the
soft-delete stamp when there is one). The list reducer keeps a bounded set of tombstones
(`__removed`, last 500 ids) and drops any upsert or removal whose version is not newer than what it
has seen for that row, so a late upsert cannot resurrect a removed row. A fresh snapshot (resync,
retry or reconnect) keeps the tombstones through `listStreamRebase`; a tombstone yields only to a
newer copy of its row in the snapshot. `updatedAt` is stamped by
the writing process, so the guard inherits that clock; a removal that the client never saw
(published before it subscribed) leaves no tombstone.

### Producing appends

Appends are app-event output, like refetch hints, built only with `streamAppend`. The handoff
type is branded (`ValidatedStreamAppend`), so a hand-built stream handoff does not typecheck, and
message handoffs are typed as `WSQueryEvent`, so a data frame cannot be smuggled through a
`{ userIds }` or `{ channels }` message. In `streamAppend` (`apps/api/src/appEvents/streamAppend.ts`)
the action type is checked against the definition,
the payload is typed by the action's schema and parsed with it before the handoff exists, and a
`perRecipient` definition requires `userIds`:

```typescript
websocket: ({ contact }) => organizationContactUpsert(contact),

// organizationContactUpsert:
streamAppend(organizationContactsStream, { id: contact.organizationId }, 'upsert',
  toJsonWire(ContactScalarSchema.parse(contact)));
```

`deliverWSHandoffs` calls `appendToStream`, which wraps the action in the append frame and
publishes through Redis.

### Frontend

```typescript
const contacts = useStream(organizationContactsStream, { id }, listStreamFolding); // { reduce, rebase }
useStreamAction(organizationContactsStream, { id }, 'remove', (removal) => toast(removal.id));
```

- `useStream(definition, params, { reduce, rebase? })` returns a TanStack query result holding the
  snapshot. `reduce` maps **every** action type to a `(state, payload) => state` reducer; a
  missing handler is a type error. `rebase(previous, snapshot)` merges state a fresh snapshot
  must keep (the list folding keeps tombstones). `listStreamFolding` bundles both for lists.
- `useStreamAction(definition, params, type, listener)` registers a side-effect listener for one
  action type; any number may be mounted.
- Reducers and listeners share one open stream through the existing holder refcounting: the
  query-cache observer and each listener hold the stream, and it closes when the last one
  unmounts. When several `useStream` holders pass different reducers, the first mounted folds.
- `listStreamReducers` (`packages/ui/src/lib/ws/listStreamReducers.ts`) is the list reducer. Rows
  stay in the list routes' default `id desc` order. An upsert replaces a held row (unless older),
  inserts a row that belongs among the loaded rows, and ignores one beyond the loaded page. A
  remove drops a held row, or, for an off-page row, only decrements `pagination.total` (once).
  Inserts beyond `pageSize` evict the oldest held row, so a long-lived stream stays one page.

`dispatchMessage` validates every snapshot and append against the definition. An invalid
snapshot puts the stream's query in the error state; an invalid or unknown append is dropped and
the client re-opens the stream for a fresh snapshot (`websocket.resync`).

`openRejected` puts the query in the error state and wipes its data; the stream stays held (the
holder count is kept) but is not replayed until a new holder mounts or the identity changes. A
retryable `error` puts the query in the error state but keeps the last snapshot, and the client
re-opens with exponential backoff (1s doubling to 30s, jittered), resetting once an open
succeeds. An open that gets no answer within 10 seconds is treated the same way. Each open is
counted until its answer arrives, so an answer to an open that a later open superseded is
ignored. Data frames are routed by `category` before any control-frame handling, and frames for a
stream the client no longer holds, or that was rejected, are ignored.

## Frontend and horizontal scaling

`useApiWebsocket()` is mounted at each app root. The client slice's query-cache listener subscribes
and unsubscribes mounted queries gated by `LIVE_QUERIES`, and opens and closes streams for
mounted stream queries; `setClient` wires the QueryClient and reconnect recovery.

`sendToChannel`, `sendToUser`, `appendToStream` and `broadcast` publish through Redis
`ws:broadcast`. Each API instance delivers to its local registry. Stream snapshots are served by
whichever instance holds the socket; appends reach streams open on any instance. Redis failure
falls back to local delivery, so cross-instance delivery is unavailable during the outage.

## Source and verification

- `packages/shared/src/ws/`: events, channel keys, channel registry, stream definitions, list
  schemas, frame limits and browser transport.
- `packages/db/src/streams/`: stream definitions and the stream registry.
- `packages/ui/src/lib/ws/`: API socket, pacing, acknowledgement/retry handling, dispatch, reducer
  and listener registries, list reducers.
- `packages/ui/src/hooks/useStream.ts`, `useStreamAction.ts`: consumer hooks.
- `apps/api/src/ws/`: handler, identity, route resolution, stream access and re-authorization,
  registries, delivery, ordering and Redis pub/sub.
- `apps/api/src/ws/probe.test.ts`: real-route authorization, unknown channels, dot segments,
  missing credentials and spoof authority.
- `apps/api/src/ws/dataStreams.test.ts`: open/snapshot/held appends, transient vs rejected
  statuses, the pending-frame cap, credential swaps and re-authorization after revocation.
- `apps/api/src/ws/streamAudience.test.ts`: the audience enforcement.
- `apps/api/src/ws/pubsub.test.ts`: per-stream publish order and per-recipient delivery.
- `apps/api/src/appEvents/handlers/contact/organizationContactsStream.test.ts`: app event →
  Redis → open socket, with typed payloads matching the route snapshot.
- `packages/ui/src/lib/ws/createApiWebsocket.test.ts`, `framePacer.test.ts`,
  `listStreamReducers.test.ts`, `dispatch.test.ts`, `packages/ui/src/hooks/useStream.test.tsx`:
  client protocol, pacing, retries, reducers and hooks.

See [APP_EVENTS.md](APP_EVENTS.md) and [Segments](SEGMENTS.md#events-and-email-integration).
