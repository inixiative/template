# App Events

## Why This Exists

Every SaaS follows the same painful progression:

1. **Direct calls everywhere.** `sendInvitationEmail(inquiry)` in the controller. `sendToSlack(message)` next to it. Analytics `track()` call after that. Each side effect is a direct function call in business logic.

2. **The coupling tax.** Adding SMS means touching every controller that sends email. Changing the email provider means finding every `sendEmail` call. A/B testing notification channels means feature flags in business logic. Testing means mocking 5 different services per controller test.

3. **The reliability tax.** Email provider is down → API request fails. Slow Segment call → slow response. One side effect throws → other side effects never fire. Retry logic duplicated everywhere.

4. **The eventual migration.** Everyone ends up with: an event bus that decouples business logic from side effects, adapter registries per delivery channel, and background jobs for anything that talks to external services.

This system skips straight to step 4. Business logic emits events. Everything else is a bridge.

---

## Architecture

```
Business logic
  │  emitAppEvent('inquiry.sent', inquiry, { resourceType, resourceId })
  ▼
emit.ts (auto-enriches actor from auditActorContext)
  ▼
appEventHandlers[name](event)  ← centralized map, like jobHandlers
  ▼
makeAppEvent handler (Promise.allSettled across bridges)
  ├─ observe  → enqueueJob('recordAppEvent')  → AppEvent table
  ├─ email    → enqueueJob('sendEmail')        → Resend/Console
  ├─ websocket → sendToChannel/sendToUser       → Redis pub/sub → frontend
  └─ cb       → raw callbacks
```

Nothing synchronous hits external services in the request path. Observe and email go through BullMQ jobs. WebSocket is Redis pub/sub (milliseconds). The API response is unblocked.

---

## Usage

### Emitting Events

```typescript
import { emitAppEvent } from '#/appEvents';

// Actor context auto-captured from auditActorContext (AsyncLocalStorage)
await emitAppEvent('inquiry.sent', inquiry, {
  resourceType: 'Inquiry',
  resourceId: inquiry.id,
});
```

If called inside `db.txn()`, handlers defer to `onCommit`. If outside, handlers run immediately.

### Defining a New Event

1. Create handler file in `appEvents/handlers/{module}/{eventName}.ts`:

```typescript
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type MyEventPayload = { userId: string; action: string };

export const myEvent = makeAppEvent<MyEventPayload>({
  email: (data) => [{ to: [{ userIds: [data.userId] }], template: 'my-template', data }],
  websocket: (data) => [{ target: { userIds: [data.userId] }, message: { data } }],
  observe: (data) => ({ userId: data.userId, action: data.action }),
});
```

2. Register in `appEvents/handlers/index.ts`:

```typescript
import { myEvent, type MyEventPayload } from '#/appEvents/handlers/module/myEvent';

// Add to AppEventPayloads
export type AppEventPayloads = {
  // ...existing
  'module.myEvent': MyEventPayload;
};

// Add to AppEventName
export const AppEventName = {
  // ...existing
  myEvent: 'module.myEvent',
} as const;

// Add to appEventHandlers
export const appEventHandlers: Record<AppEventName, AppEventHandlerFn> = {
  // ...existing
  'module.myEvent': myEvent,
};
```

3. Emit from business logic.

### Handler Definition

```typescript
type AppEventHandlerDefinition<T> = {
  email?: (data: T) => EmailHandoff[] | null;     // enqueues sendEmail job
  websocket?: (data: T) => WSHandoff[] | null;     // pushes to channels/users
  observe?: (data: T) => ObserveData | null;        // enqueues recordAppEvent job
  cb?: Array<(data: T) => Promise<void> | void>;    // raw callbacks
};
```

Each bridge runs in parallel via `Promise.allSettled`. One bridge failing doesn't affect others.

---

## Email Pipeline

```
Handler returns EmailHandoff[]
  ↓
Email bridge → enqueueJob('sendEmail', handoff)
  ↓
sendEmail job (BullMQ worker):
  1. resolveTargets(to/cc/bcc)  → email addresses
  2. verifyAddresses (Bouncer)  → skip undeliverable/disposable
  3. resolveFromAddress          → platform default (stub: future BYOE cascade)
  4. composeTemplate             → MJML from DB (cascade: Space → Org → default)
  5. interpolate per recipient   → {{sender.*}}, {{recipient.*}}, {{data.*}}
  6. mjml2html                   → HTML
  7. client.sendBatch            → Resend (chunks at 100) or Console
```

### Email Targeting

```typescript
// Individual users
{ to: [{ userIds: ['user-1', 'user-2'] }] }

// Raw addresses
{ to: [{ raw: ['external@example.com'] }] }

// Org role (escalates: admin → admin + owner)
{ to: [{ orgRole: { organizationId: '...', role: 'admin' } }] }

// Space role
{ to: [{ spaceRole: { spaceId: '...', role: 'member' } }] }

// Group with cc/bcc
{
  to: [{ userIds: ['primary'] }],
  cc: [{ orgRole: { organizationId: '...', role: 'admin' } }],
  bcc: [{ raw: ['compliance@example.com'] }],
}
```

### Email Templates

MJML templates stored in DB with component composition:

```
{{#component:system-header}}{{/component:system-header}}
<mj-text>Hi {{recipient.name}}, {{data.inviterName}} invited you...</mj-text>
{{#component:system-button}}{{/component:system-button}}
{{#component:system-footer}}{{/component:system-footer}}
```

Seeded templates: `email-verification`, `org-invitation`, `welcome`.

---

## Observe Pipeline

Every event handler can define what data to persist:

```typescript
observe: (inquiry) => ({
  inquiryId: inquiry.id,
  type: inquiry.type,
  targetUserId: inquiry.targetUserId,
})
```

This goes through the observe `BroadcastRegistry` → currently the DB adapter enqueues a `recordAppEvent` job → writes to `AppEvent` table. Future: register Segment, Datadog adapters alongside DB.

---

## Adapter Registries

Each delivery channel gets its own `BroadcastRegistry` instance:

```typescript
// lib/email.ts
export const emailRegistry = makeBroadcastRegistry<EmailClient>();
emailRegistry.register('resend', createResendClient(apiKey));

// lib/observe.ts
export const observeRegistry = makeBroadcastRegistry<ObserveAdapter>();
observeRegistry.register('db', createDbObserveAdapter());
```

`BroadcastRegistry<A>` supports both:
- `get(name)` / `getOrDefault(name, fallback)` — pick one adapter (email: tenant's provider)
- `broadcast(fn)` — fan out to all (observe: DB + Segment + Datadog)

---

## Inquiry Events

Inquiry events route by inquiry type. Each `InquiryHandler` has an `appEvents` key:

```typescript
// modules/inquiry/handlers/inviteOrganizationUser/appEvents.ts
export const inviteOrganizationUserAppEvents: InquiryAppEvents = {
  sent: {
    email: (inquiry) => [{ to: [...], template: 'org-invitation', data: {...} }],
    websocket: (inquiry) => [{ target: {...}, message: {...} }],
  },
  approved: { ... },
  denied: { ... },
  changesRequested: { ... },
  resolved: { ... },
};
```

The `inquiry.sent` and `inquiry.resolved` handlers in `appEvents/handlers/inquiry/` dispatch to these callbacks based on `inquiry.type`.

---

## File Layout

```
apps/api/src/
├── appEvents/
│   ├── bridges/
│   │   ├── email.ts           handoff → enqueueJob (glue)
│   │   └── websocket.ts       handoff → sendToChannel/User
│   ├── handlers/
│   │   ├── index.ts           AppEventPayloads + AppEventName + appEventHandlers
│   │   ├── inquiry/
│   │   │   ├── inquirySent.ts
│   │   │   └── inquiryResolved.ts
│   │   └── user/
│   │       ├── userCreated.ts
│   │       └── userVerificationRequested.ts
│   ├── emit.ts                emitAppEvent<K>(name, data, options?)
│   ├── makeAppEvent.ts        returns AppEventHandlerFn
│   ├── types.ts               EmailHandoff, WSHandoff, ObserveData, etc.
│   └── index.ts               re-exports emitAppEvent + types
├── lib/
│   ├── email.ts               emailRegistry + emailVerifier + resolveFromAddress
│   ├── observe.ts             observeRegistry + DB adapter
│   └── resolveTargets.ts      EmailTarget[] → ResolvedRecipient[]
└── jobs/handlers/
    ├── sendEmail.ts           resolve → verify → compose → render → send
    └── recordAppEvent.ts      write to AppEvent table
```

---

## Stubs / Future Work

| Feature | Status | Notes |
|---------|--------|-------|
| Sender resolution | Stub | Always platform default. Future: cascade Space → Org → User |
| Template locale | Stub | Hardcoded `en`. Future: recipient preference |
| Email client selection | Stub | First registered adapter. Future: per-tenant BYOE |
| SMS bridge | Not started | Add to AppEventHandlerDefinition when needed |
| Chat bridge (Slack/Teams/Discord) | Not started | Same pattern as email |
| Notify bridge (in-app) | Not started | Redis-backed, WebSocket push |
| Unsubscribe | Not started | CommunicationCategory exists, need preference model + endpoint |
| Workflow primitives | Not started | Delay, digest, skip via BullMQ job chains |
| Email delivery tracking | Not started | Provider webhooks → app events |

See `tickets/FEAT-012-notifications.md` for full roadmap.

---

## WebSockets

Located in `apps/api/src/ws/`. Redis pub/sub for multi-instance support.

### Connection

```
ws://localhost:8000?token=<bearer_token>
```

### Client Messages

```typescript
{ "action": "subscribe", "channel": "org:abc123" }
{ "action": "unsubscribe", "channel": "org:abc123" }
{ "action": "ping" }
{ "action": "disconnect" }
```

### Server Messages

```typescript
{ "type": "connected", "connectionId": "...", "userId": "..." }
{ "type": "subscribed", "channel": "org:abc123" }
{ "type": "pong", "timestamp": 1234567890 }
```

### Frontend

- `useWebSocket` hook (currently named `useAppEvents` — rename pending)
- `useEventRefetch` — match events to TanStack Query invalidation rules
- Auto-connect session hook — not yet wired into app layouts
