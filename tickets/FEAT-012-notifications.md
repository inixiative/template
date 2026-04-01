# FEAT-012: App Events System & Notification Workflows

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-04-01

---

## Overview

Build a typed app events system that bridges domain events to outgoing side effects via adapter classes and workflow primitives. Uses existing infrastructure (BullMQ, Redis pub/sub, WebSockets, email adapters) — no additional services required.

---

## Architecture

### Three Layers

```
Layer 1: App Events (typed domain events)
  createAppEvent('inquiry.approved', payload)

Layer 2: Workflows (multi-step, potentially delayed reaction chains)
  Each event triggers N workflows in parallel
  Each workflow is a sequence of steps backed by BullMQ

Layer 3: Adapter Classes (delivery)
  Each step hands off to an adapter class (email, websocket, notify, etc.)
  Each class can have multiple registered adapters (Resend + SES under email)
  All enabled adapters in a class fire (broadcast within class)
```

### Event → Workflows → Steps → Adapters

```
createAppEvent('inquiry.approved', payload)
  │
  ├─ workflow: 'notify-inquiry-target'
  │    step 1: in-app notification (immediate)
  │    step 2: delay 1 hour
  │    step 3: email if unread (skip condition)
  │
  ├─ workflow: 'sync-inquiry-analytics'
  │    step 1: track in analytics/data lake
  │
  ├─ workflow: 'onboard-new-space'  (if type=createSpace)
  │    step 1: enqueue onboarding jobs
  │
  └─ raw callbacks: websocket broadcast, webhook relay
```

---

## Design Decisions

### Typed Event Definitions (like Jobs + Inquiries)

Each event has a typed payload schema, following the pattern established by `JobPayloads` and `InquiryHandler`:

```typescript
type AppEventPayloads = {
  'inquiry.approved': { inquiryId: string; type: InquiryType; targetUserId: string; orgId: string }
  'inquiry.sent': { inquiryId: string; type: InquiryType; targetModel: string }
  'organization.userAdded': { organizationId: string; userId: string; role: Role }
  // ...
}
```

### Adapter Classes (categories, not individual adapters)

Adapter classes are delivery categories. Each class has a registry of adapters. When a step targets a class, all enabled adapters in that class fire.

| Class | Adapters (examples) | Needs targeting? |
|-------|---------------------|-----------------|
| email | Resend, Console, SES | Yes — recipient resolution |
| sms | Twilio, Console | Yes — phone resolution |
| chat | Slack, Discord | Yes — channel/workspace resolution |
| notify | InApp (DB-backed) | Yes — userId |
| websocket | WS (built-in) | Yes — channel names |
| dataLake | Segment, BigQuery | No — firehose, gets raw event |
| observe | Datadog, Console | No — firehose, gets raw event |

**Firehose classes** (dataLake, observe) need no targeting — they receive every event (or filter by type) and are pure BYOI (bring your own integration).

**Targeted classes** (email, sms, chat, notify, websocket) need per-event targeting logic that varies by event. Different events have fundamentally different audiences: a specific user, all org admins, all space members, a customer segment, etc.

### Handler Pattern: Typed Handoff Callbacks (like Inquiry Handlers)

The core design pattern follows the inquiry system: each event is a handler object with **named callback slots per adapter class**. Each callback's job is to transform the event payload into the adapter class's **native input type** and hand it off. The callback owns targeting and formatting. The adapter class owns delivery, retries, error handling, logging, preferences, and fan-out to all registered adapters.

This is exactly how inquiry handlers work: `handleApprove` can do whatever it wants internally, but it returns `Partial<TResolution>` — the contract is in the return type. The inquiry infrastructure then handles the DB transaction, audit logging, status transition, and expiration clearing. The handler doesn't know about any of that.

```typescript
// Each adapter class defines its native message type
type EmailMessage = { to: string[]; template: string; data: Record<string, unknown> };
type InAppNotification = { userIds: string[]; title: string; body: string; actionUrl?: string };
type WSBroadcast = { channels: string[]; data: Record<string, unknown> };
type ChatMessage = { channel: string; text: string; blocks?: unknown[] };
type SmsMessage = { to: string[]; body: string };

// The handler interface: one optional typed callback per adapter class
type AppEventHandler<T> = {
  schema: z.ZodType<T>;
  email?: (event: AppEventPayload<T>, ctx: EventContext) => Promise<EmailMessage | null>;
  notify?: (event: AppEventPayload<T>, ctx: EventContext) => Promise<InAppNotification | null>;
  websocket?: (event: AppEventPayload<T>, ctx: EventContext) => Promise<WSBroadcast | null>;
  chat?: (event: AppEventPayload<T>, ctx: EventContext) => Promise<ChatMessage | null>;
  sms?: (event: AppEventPayload<T>, ctx: EventContext) => Promise<SmsMessage | null>;
  // Adapter classes not declared are skipped (unless firehose)
};
```

**Why typed handoff instead of raw callbacks:**

| Concern | Raw callback (does everything) | Typed handoff (returns message) |
|---------|-------------------------------|-------------------------------|
| Retry logic | Each callback implements its own | Adapter class owns it uniformly |
| Error handling | Inconsistent across events | Uniform per class |
| Logging/observability | Maybe, maybe not | Adapter class always logs |
| User preferences | Each callback checks (or forgets) | Adapter class checks once |
| Rate limiting | Per callback | Per class |
| Adapter fan-out | Callback knows about Resend + SES | Class broadcasts to all registered adapters |

The callback is flexible (can do async lookups, conditional logic, complex targeting), but the **typed return** constrains it to produce something the adapter class knows how to deliver. This gives uniform behavior without sacrificing flexibility.

**Example handler:**

```typescript
const inquiryApprovedHandler: AppEventHandler<InquiryApprovedPayload> = {
  schema: inquiryApprovedSchema,

  email: async (event, ctx) => {
    const user = await ctx.db.user.findUnique({ where: { id: event.data.targetUserId } });
    if (!user?.email) return null;
    return { to: [user.email], template: 'inquiry-approved', data: { type: event.data.type } };
  },

  notify: async (event) => ({
    userIds: [event.data.targetUserId],
    title: 'Inquiry Approved',
    body: `Your ${event.data.type} request was approved`,
    actionUrl: `/inquiries/${event.data.inquiryId}`,
  }),

  websocket: async (event) => ({
    channels: [`user:${event.actorId}`, `org:${event.data.orgId}`],
    data: { inquiryId: event.data.inquiryId, type: event.data.type },
  }),

  // sms, chat: not declared — skipped for this event
};
```

As patterns emerge across events (e.g., "look up org admins" repeating), extract **targeting helpers** — but don't abstract prematurely. Let the seams reveal themselves after 5-10 events exist.

### Workflow Primitives (built on BullMQ)

Instead of adopting Novu or another workflow engine, build lightweight primitives on existing infrastructure:

| Primitive | Implementation |
|-----------|---------------|
| Sequential steps | Job chain (each step enqueues the next) |
| Delay | `enqueueJob` with `delay` option |
| Skip/condition | `if` in the workflow handler |
| Digest/batch | Job that waits N minutes, aggregates, then delivers |
| Retry | BullMQ's built-in retry with backoff |

This avoids adding MongoDB, a second job queue, or a second WebSocket server. If a team later wants Novu's full product (visual editor, drop-in Inbox, subscriber preferences UI), they can swap in a `NovuWorkflowEngine` adapter.

### Firehose Adapters (BYOI)

Firehose classes are globally registered, receive every event, and require no per-event configuration:

```typescript
registerFirehoseAdapter('segment', async (event) => {
  await segment.track({ event: event.type, properties: event.data });
});

registerFirehoseAdapter('datadog', async (event) => {
  datadog.increment(`app.events.${event.type}`);
});
```

### Stubbed by Default

The template ships with all adapter class keys visible but noop/null for unconfigured classes. This makes extension points obvious and discoverable without requiring any specific integration to be enabled.

---

## Event Taxonomy (Initial)

### User Events
| Event | Trigger Point |
|-------|--------------|
| `user.signedUp` | After registration |
| `user.verified` | Email verification |
| `user.updated` | Profile change |
| `user.deleted` | Account deletion |

### Organization Events
| Event | Trigger Point |
|-------|--------------|
| `organization.created` | New org |
| `organization.updated` | Org settings change |
| `organization.deleted` | Org removal |
| `organization.userAdded` | Member joined (inquiry approved or direct) |
| `organization.userRemoved` | Member removed |
| `organization.userRoleChanged` | Role updated |

### Space Events
| Event | Trigger Point |
|-------|--------------|
| `space.created` | Inquiry approved |
| `space.updated` | Inquiry approved |
| `space.transferred` | Inquiry approved |
| `space.deleted` | Space removal |

### Inquiry Events
| Event | Trigger Point |
|-------|--------------|
| `inquiry.created` | New inquiry drafted |
| `inquiry.sent` | Sent to target |
| `inquiry.approved` | Target approved |
| `inquiry.denied` | Target denied |
| `inquiry.changesRequested` | Target wants changes |
| `inquiry.canceled` | Source canceled |

### Job Events
| Event | Trigger Point |
|-------|--------------|
| `job.completed` | Handler finished |
| `job.failed` | All retries exhausted |

### Webhook Events
| Event | Trigger Point |
|-------|--------------|
| `webhook.delivered` | Successful delivery |
| `webhook.failed` | Delivery failed |
| `webhook.disabled` | Circuit breaker tripped |

---

## Current State

**Exists (infrastructure):**
- Event emit/registry/handler system (`apps/api/src/events/`)
- WebSocket broadcast handler (wildcard `*`)
- Frontend hooks (`useAppEvents`, `useEventRefetch`)
- 3 placeholder types: `user.signedUp`, `user.verified`, `user.updated`
- Adapter primitives (`makeAdapterRouter`, `makeAdapterRegistry`)
- Email adapter (Resend + Console)
- Error reporter adapter (Sentry + Console)
- BullMQ job system with typed handlers

**Missing:**
- Zero `createAppEvent()` calls in any business logic
- No typed payloads per event (everything is `Record<string, unknown>`)
- No adapter class registries
- No workflow primitives (delay, digest, skip)
- No connection between events and inquiry/job lifecycles
- No firehose adapter pattern
- No in-app notification system (DB schema, API, UI)

---

## Implementation Phases

### Phase 1: Typed Event Foundation
- Typed `AppEventPayloads` map (like `JobPayloads`)
- `defineAppEvent()` with schema + per-class callbacks
- Adapter class registry infrastructure
- Wire `createAppEvent()` calls into inquiry lifecycle (sent, approved, denied, canceled)
- Wire into user lifecycle (signedUp, verified)

### Phase 2: Adapter Classes
- Formalize email, websocket, notify adapter class interfaces
- Firehose adapter pattern (register globally, receive all events)
- Stub all classes with noop defaults

### Phase 3: Workflow Primitives
- Sequential step execution via BullMQ job chains
- Delay step (BullMQ delay option)
- Skip/condition step
- Digest step (aggregation job)

### Phase 4: In-App Notifications
- Notification DB schema (userId, title, body, read/unread, type, actionUrl)
- CRUD API endpoints
- Notification center UI component
- WebSocket real-time delivery
- Read/unread, bulk actions, filtering

### Phase 5: Optional Novu Adapter
- `NovuWorkflowEngine` adapter for teams wanting the full product
- Maps workflow definitions to `novu.trigger()` calls
- Provides visual editor, subscriber preferences, drop-in Inbox

---

## Novu Evaluation Notes

Evaluated Novu (open-source notification infrastructure) as a potential foundation. Findings:

**Strengths:** Multi-channel delivery, provider swapping, digest/delay as first-class steps, subscriber preferences, drop-in React Inbox component, code-first workflows with `@novu/framework`, `step.custom()` for arbitrary code.

**Limitations:** Workflows are sequential only (no parallel fan-out), requires MongoDB + its own Redis/Worker/WS services (duplicates our stack), not a general-purpose event reaction system (handles notifications, not webhooks/analytics/data lake).

**Decision:** Build own primitives on existing BullMQ/Redis infrastructure. Keep Novu as optional Phase 5 adapter for teams wanting the full notification product. Our app events system needs to fan out to websockets, data lake, analytics, webhooks, AND notifications in parallel — Novu handles one slice (notifications) well but not the broader event reaction pattern.

---

## Related Tickets

- **Depends on**: INFRA-004 (WebSockets — in progress)
- **Related**: INFRA-009 (Adapter Primitives — in progress)
- **Blocks**: None

---

## Open Questions

1. **Targeting helpers** — What shared primitives emerge after implementing 5-10 events? (Defer until seams appear)
2. **Event persistence** — Separate `AppEvent` table for event store, or is audit log sufficient?
3. **Workflow definition co-location** — Do workflow definitions live with the event, or in separate files per workflow?
4. **Adapter class taxonomy** — Are the 7 classes listed above the right set, or do we need more/fewer?
5. **Subscriber/preference model** — When we add notification preferences (Phase 4), do we build our own or adopt Novu's model?
