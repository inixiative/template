# WebSockets — realtime query refetch

Server-driven cache invalidation: when something changes on the backend, connected clients
**refetch the affected query through its normal authorized route**. The socket never carries
domain data — only "this query is stale, refetch it." That's the whole security model: a client
can only see what its own authorized route returns, so a refetch signal can't leak anything.

This is the realtime layer behind app events' `websocket` reach (see [APP_EVENTS.md](./APP_EVENTS.md)).

---

## The shared contract (`@template/shared/ws`)

Both ends type against one source of truth so they can't drift.

```ts
// channelKey.ts — a query's routing key. Keeps the route identity (_id) + path scope; drops
// query/headers/body. Same serialization as cacheKey (sorted, colon-joined): "adminBotRead:id:b1".
channelKey({ _id, path }) → string

// events.ts — server → client events, discriminated by category + action.
type WSEvent = { category: 'query'; action: 'refetch'; key: ChannelKeyInput };

// liveQueries.ts — the registry: operationIds (queryKey[0]._id) that have a BE producer.
// The FE pipes every query through subscribe, gated by this set, so we never subscribe to
// channels the server can't emit to.
LIVE_QUERIES: Set<string>
```

`key` is the query identity `{ _id, path? }`. `channelKey(key)` routes the emit; the FE invalidates
`[key]` (react-query prefix-matches, so a key with no `path` invalidates every variant).

---

## End-to-end flow

```
BE: appEvent.websocket(data) → [{ category:'query', action:'refetch', key:{ _id, path } }]
      → makeAppEvent → sendToChannel(channelKey(key), event)
      → Redis pub/sub (ws:broadcast)  ──► every API instance
      → sendToChannelLocal: deliver event to local connections subscribed to that channel
FE: createApiWebsocket.onMessage → dispatchMessage → handlers.query.refetch
      → queryClient.invalidateQueries({ queryKey: [event.key] }) → refetch via authorized route
```

---

## Making a query live (two steps)

1. **Register the operationId** in `packages/shared/src/ws/liveQueries.ts` `LIVE_QUERIES`.
2. **Emit a refetch** from the relevant app event's `websocket` reach:
   ```ts
   websocket: (bot) => [{ category: 'query', action: 'refetch', key: { _id: 'adminBotRead', path: { id: bot.id } } }],
   ```
That's it. The FE auto-subscribes any mounted query whose `_id` is in `LIVE_QUERIES` and refetches
it when the event arrives.

---

## Frontend

- **`packages/shared/src/ws/createWebSocketClient.ts`** — generic browser transport: connect,
  auto-reconnect, send-queue, `reconnect()` (force-drop a half-open socket).
- **`packages/ui/src/lib/ws/createApiWebsocket.ts`** — the API adapter. Owns the **channel
  refcount Map** (single source of truth, replayed on every reopen), wires inbound → `dispatchMessage`,
  and runs the **bidirectional heartbeat** (ping → expect pong within 5s, else `reconnect()`).
- **`packages/ui/src/lib/ws/dispatch.ts`** — `handlers[category][action]` map; `query.refetch` →
  `invalidateQueries([event.key])`. Reads the client off the store.
- **client slice (`store/slices/client.ts`)** — the pipe: a `queryCache` subscriber turns
  `observerAdded`/`observerRemoved` into `websocket.subscribe`/`unsubscribe`, gated by `LIVE_QUERIES`.
  `setClient` (called from each app's `main.tsx`) wires this and, on reconnect, invalidates live
  queries to recover anything missed while offline.
- **`useApiWebsocket()`** — mount once at the app root; connects on load.

The QueryClient is created at the app root (`createAppQueryClient` in `main.tsx`, beside the router)
and registered into the store via `setClient` — so the store never *constructs* the client (no import
cycle); its error handlers read the store.

---

## Connection lifecycle (backend `apps/api/src/ws/`)

- **Identity** is set by message, gated by token: `authenticate` / `spoof` (by email, superadmin-only)
  / `unspoof` / `logout`. A connection's `userId` is only ever set from a verified token.
- **Subscriptions** are exact-match channels (`byChannel` index). List surfaces collapse onto one
  channel because `channelKey` drops query params.
- **Heartbeat (both directions):** FE pings; BE `pong`s + refreshes `lastPing`. The stale-sweep
  (`cleanupStaleConnections`) closes connections idle past `STALE_TIMEOUT_MS`. FE arms a pong-timeout
  and force-reconnects if the server goes silent (half-open detection).
- **Reconnect recovery:** transport auto-reconnects → `createApiWebsocket` replays its channel set
  → slice invalidates live queries. So any drop (network, server restart, sweep) self-heals.

---

## Horizontal scaling

`sendToChannel`/`sendToUser`/`broadcast` publish to a single Redis channel `ws:broadcast`; every API
instance subscribes (`initWebSocketPubSub()` at boot) and delivers to its **local** connections.
So an event emitted on instance A reaches subscribers on B and C. If Redis is down, delivery falls
back to local-only (single-instance). Every instance sees every event and filters by its local
registry — simple and correct; shard the Redis channel only if event volume demands it.

---

## File map

```
packages/shared/src/ws/    channelKey.ts, events.ts (WSEvent), liveQueries.ts, createWebSocketClient.ts
packages/ui/src/lib/ws/    createApiWebsocket.ts (refcount + heartbeat), dispatch.ts
packages/ui/src/store/slices/client.ts   setClient + the queryCache→subscribe pipe
packages/ui/src/hooks/useApiWebsocket.ts mount at app root
apps/api/src/ws/           registry, identity, subscriptions, delivery, lifecycle, handler, pubsub, auth
apps/api/src/appEvents/makeAppEvent.ts    websocket reach → sendToChannel(channelKey(key), event)
```
