# App Events

<!-- toc:start -->

## Contents

- [Purpose and execution](#purpose-and-execution)
- [Emitting and registering events](#emitting-and-registering-events)
- [Handler and handoff contracts](#handler-and-handoff-contracts)
- [Email pipeline](#email-pipeline)
- [WebSocket handoffs](#websocket-handoffs)
- [Observe pipeline](#observe-pipeline)
- [Inquiry events](#inquiry-events)
- [Source map and pending consumers](#source-map-and-pending-consumers)

<!-- toc:end -->

## Purpose and execution

Business write paths emit events; handlers select side effects. Email delivery runs in jobs,
WebSocket handoffs use Redis pub/sub, and observation records the event envelope. This keeps
delivery logic out of controllers and lets each consumer evolve independently.

`emitAppEvent(name, data)` creates a UUIDv7 envelope with actor provenance from
`auditActorContext` and dispatches the registered handler. Inside `db.txn()`, execution is
registered with `db.onCommit`; outside a transaction, the handler is awaited immediately.

`makeAppEvent` executes observation, each email/WebSocket handoff, and each callback through
`db.parallel(tasks, { resolution: 'allSettled' })`. Each task gets its own database async scope.
A failed task does not prevent siblings from running; collected failures are thrown after
settlement. This isolation matters when a callback starts a transaction or runs a test-mode job
inline while the observe adapter also writes.

## Emitting and registering events

```typescript
import { emitAppEvent } from '#/appEvents';

await emitAppEvent('user.verificationRequested', {
  userId: user.id,
  verificationUrl,
});
```

Event names and payload types are declared in `apps/api/src/appEvents/handlers/index.ts`.
Add the payload, `AppEventName` entry and handler registration there. Each handler lives in
its feature folder and is constructed with `makeAppEvent`:

```typescript
export const userVerificationRequested = makeAppEvent<UserVerificationRequestedPayload>({
  email: (data) => [{
    template: 'email-verification',
    data: { userId: data.userId, verificationUrl: data.verificationUrl },
  }],
});
```

## Handler and handoff contracts

```typescript
type EmailHandoff = {
  template: string;
  data: Record<string, unknown>;
};

type WSMessageHandoff = {
  target: { channels: string[] } | { userIds: string[] };
  message: { data: Record<string, unknown> };
};

type WSStreamAppendHandoff = {
  target: { stream: string; userIds?: string[] };
  append: { type: string; payload: unknown };
};

type WSHandoff = WSMessageHandoff | WSStreamAppendHandoff;

type AppEventHandlerDefinition<T> = {
  email?: (data: T) => EmailHandoff[] | null;
  websocket?: (data: T) => WSHandoff[] | null;
  cb?: Array<(data: T) => Promise<void> | void>;
};
```

There is no per-handler `observe` selector: the complete envelope is always sent to the
observe registry. Sender, recipients and delivery policy are defined by the email registry,
not supplied as `to`/`cc`/`bcc` on an event's email handoff.

## Email pipeline

`deliverEmailHandoffs` enqueues `sendEmail` with the template, event name and binding data,
using a deterministic planner job ID. The registry entry in `apps/api/src/lib/email/registry.ts`
defines the entity lens, sender, recipient rules, data lens and render policy.

The planner resolves entity/sender/template ownership, hydrates recipients through the
owner-scoped recipient lens, and creates or reuses a `CommunicationLog` row per recipient
using its idempotency key. It then enqueues `deliverEmail`. Delivery settles the template and
its component versions, applies contact preferences and address verification, renders and
sends, and records the result. See [COMMUNICATIONS.md](COMMUNICATIONS.md#planner-sendemail)
for the complete planner/delivery and degraded-rule behavior.

## WebSocket handoffs

Channel-targeted example, from `segmentMembersAdded`:

```typescript
websocket: (data) => [{
  target: { channels: [WS_CHANNELS.segmentReadManySegmentMembers.name(data.segmentId)] },
  message: { data: refetch({ _id: 'segmentReadManySegmentMembers', path: { id: data.segmentId } }) },
}],
```

`deliverWSHandoffs` sends a message handoff through `sendToChannel` or `sendToUser`, and a
stream handoff through `appendToStream`. The frontend handles query-refetch hints and
data-stream actions. New payload kinds require their own consumer and recovery design.
Subscription and stream-open checks use the underlying authorized route; see
[WEBSOCKETS.md](WEBSOCKETS.md).

Stream handoffs are never built by hand. `streamAppend` (`apps/api/src/appEvents/streamAppend.ts`)
takes a shared stream definition, its params, an action type and a payload. The action type must
be one the definition declares, the payload is typed by that action's schema and parsed with it
before the handoff exists, and a `perRecipient` definition additionally requires the recipient
`userIds`. From the contact handlers (the scaffolding example stream):

```typescript
websocket: ({ contact }) => organizationContactRemove(contact),

// organizationContactRemove:
streamAppend(organizationContactsStream, { id: contact.organizationId }, 'remove', {
  id: contact.id,
  updatedAt: contact.updatedAt.toISOString(),
});
```

A `shared` stream's append goes to every connection holding the stream, so it has to match the
shape of the route's response for every caller. `appendToStream` publishes each stream's appends
through a per-stream `createSerializedQueue`, so one instance emits them in order. See
[WEBSOCKETS.md](WEBSOCKETS.md#data-streams).

Revoking access (membership, role or token removal) does not yet emit an app event that closes
streams immediately; the periodic re-authorization in
[WEBSOCKETS.md](WEBSOCKETS.md#authorization-and-re-authorization) closes them within one
interval.

Segments also publish member-side `customerRef.segmentsAdded` / `customerRef.segmentsRemoved`
events. For User customers those target the user's sockets with a membership-query refetch.
See [SEGMENTS.md](SEGMENTS.md#events-and-email-integration).

## Observe pipeline

The envelope contains `id`, `name`, `actor` and `data`. Observation broadcasts it through
`observeRegistry` to the structured log and database adapters. The database adapter directly
upserts `AppEvent` by envelope ID. This is idempotent, best-effort observation, not a durable
retry queue. The event ID encodes emit time; observation is not a separate BullMQ job.

## Inquiry events

Inquiry-specific definitions live under `apps/api/src/modules/inquiry/handlers/<type>/appEvents.ts`.
The central inquiry event handlers delegate to those definitions. For example, the
organization-invitation `sent` definition selects `inquiry-invite-organization-user` with
`{ inquiryId }` bindings and publishes an `inquiryRead` refetch. Its `resolved` definition
publishes the refetch. Use the shared handoff contracts for both.

## Source map and pending consumers

- `apps/api/src/appEvents/emit.ts`: typed emit, actor envelope and commit deferral.
- `apps/api/src/appEvents/makeAppEvent.ts`: task isolation and failure aggregation.
- `apps/api/src/appEvents/types.ts`: envelope, handoffs and handler definition.
- `apps/api/src/appEvents/channels/`: email and WebSocket delivery bridges.
- `apps/api/src/appEvents/handlers/`: business-event handlers and the registry.
- `apps/api/src/lib/observe.ts`: observation adapters.
- `apps/api/src/jobs/handlers/sendEmail.ts`, `deliverEmail.ts`: email planner and delivery.

Feature flags and persisted in-app notifications remain future consumers. Registering an event
handler does not prove that a business writer emits the event; the Segments documentation
lists the reconciliation events still waiting for production write paths.
