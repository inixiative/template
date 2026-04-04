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

### The Chain: Event → Handler → Adapter Class → Integrations

```
App Event                    Handler                      Adapter Class              Integrations
(domain data)                (typed handoff callbacks)     (logic layer)              (delivery)

createAppEvent(              handler.email(event, ctx)     Email adapter class         Resend
  'inquiry.approved',        → returns handoff:            → resolves targets          SES
  payload                      { target, message, meta }   → checks preferences        Console
)                                                          → applies rate limits
                             handler.notify(event, ctx)    → logs/observes
                             → returns handoff             → broadcasts to ALL
                               { target, message, meta }     registered integrations

                             handler.websocket(...)        Notify adapter class
                             → returns handoff             → same pattern
                               { target, message, meta }
                                                           WebSocket adapter class
                             handler.chat(...)             → same pattern
                             → null (not declared)
                             → SKIPPED                     Firehose (dataLake, observe)
                                                           → no handoff needed
                                                           → receives raw event always
```

**Three responsibilities, cleanly separated:**

1. **App Event Handler** — Knows the domain. For each adapter class it cares about, returns a typed handoff: WHO to target, WHAT to send, and META for preferences/categorization. Does not know about adapters, preferences, retries, or delivery. Can use callbacks for flexible targeting logic (look up org admins, resolve a segment, etc.).

2. **Adapter Class** — Knows the delivery category. Receives the typed handoff and owns the logic layer: resolves targets to concrete addresses, checks user communication preferences, applies rate limits, handles errors/retries, logs delivery. Then fans out to all registered integrations via broadcast-to-all pattern.

3. **Integrations** — Knows one provider. Resend, Twilio, Slack SDK, etc. Receives the resolved, preference-checked, ready-to-deliver message and sends it. Multiple integrations per class (Resend + SES under email) all fire.

### Handoff Shape (target + message + metadata)

Each adapter class defines its own typed handoff, but they all share the same structure:

```typescript
// Email handoff — handler returns this, adapter class consumes it
type EmailHandoff = {
  target: { userIds: string[] } | { orgRole: { orgId: string; role: Role } } | { raw: string[] };
  message: { template: string; data: Record<string, unknown> };
  tags: string[];       // e.g. ['inquiry', 'approval'] — for preference filtering
  category: string;     // e.g. 'transactional' | 'marketing' | 'system'
};

// Notify handoff
type NotifyHandoff = {
  target: { userIds: string[] };
  message: { title: string; body: string; actionUrl?: string };
  tags: string[];
  category: string;
};

// WebSocket handoff
type WSHandoff = {
  target: { channels: string[] } | { userIds: string[] };
  message: { data: Record<string, unknown> };
  tags: string[];
  category: string;
};
```

The adapter class uses `target` to resolve recipients, `tags` and `category` to check communication preferences and apply filtering, and `message` for the actual content. The handler never touches preferences, never calls an adapter, never knows what integrations are registered.

### Workflow Layer (on top of this)

Events can also trigger N **workflows** in parallel — multi-step, potentially delayed reaction chains backed by BullMQ:

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
  └─ immediate handoffs: websocket broadcast, firehose
```

Each workflow step ultimately produces the same typed handoff to an adapter class. The workflow just orchestrates timing and conditions around it.

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
// The handler interface: one optional typed callback per adapter class
// Each returns a typed handoff (target + message + metadata) or null to skip
type AppEventHandler<T> = {
  schema: z.ZodType<T>;
  email?: (event: AppEventPayload<T>, ctx: EventContext) => Promise<EmailHandoff | null>;
  notify?: (event: AppEventPayload<T>, ctx: EventContext) => Promise<NotifyHandoff | null>;
  websocket?: (event: AppEventPayload<T>, ctx: EventContext) => Promise<WSHandoff | null>;
  chat?: (event: AppEventPayload<T>, ctx: EventContext) => Promise<ChatHandoff | null>;
  sms?: (event: AppEventPayload<T>, ctx: EventContext) => Promise<SmsHandoff | null>;
  // Adapter classes not declared are skipped (unless firehose)
};
```

**Why typed handoff instead of raw callbacks:**

The callback is flexible (async lookups, conditional logic, complex targeting), but the **typed return** constrains it to produce a handoff the adapter class knows how to process. The handler never imports an adapter, never calls `emailClient.send()`, never checks preferences. It returns `{ target, message, tags, category }` and the plumbing does the rest.

| Concern | Raw callback (does everything) | Typed handoff (returns to adapter class) |
|---------|-------------------------------|-------------------------------|
| Retry logic | Each callback implements its own | Adapter class owns it uniformly |
| Error handling | Inconsistent across events | Uniform per class |
| Logging/observability | Maybe, maybe not | Adapter class always logs |
| User preferences | Each callback checks (or forgets) | Adapter class checks via tags/category |
| Rate limiting | Per callback | Per class |
| Target resolution | Callback resolves emails itself | Adapter class resolves userIds → addresses |
| Adapter fan-out | Callback knows about Resend + SES | Class broadcasts to all registered integrations |

This is the same pattern as inquiry handlers: `handleApprove` can do whatever it wants internally, but it returns `Partial<TResolution>`. The infrastructure handles transactions, audit logs, status transitions. The handler doesn't know about any of that.

**Example handler:**

```typescript
const inquiryApprovedHandler: AppEventHandler<InquiryApprovedPayload> = {
  schema: inquiryApprovedSchema,

  email: async (event) => ({
    target: { userIds: [event.data.targetUserId] },
    message: { template: 'inquiry-approved', data: { type: event.data.type } },
    tags: ['inquiry', 'approval'],
    category: 'transactional',
  }),

  notify: async (event) => ({
    target: { userIds: [event.data.targetUserId] },
    message: {
      title: 'Inquiry Approved',
      body: `Your ${event.data.type} request was approved`,
      actionUrl: `/inquiries/${event.data.inquiryId}`,
    },
    tags: ['inquiry', 'approval'],
    category: 'transactional',
  }),

  websocket: async (event) => ({
    target: { channels: [`user:${event.actorId}`, `org:${event.data.orgId}`] },
    message: { data: { inquiryId: event.data.inquiryId, type: event.data.type } },
    tags: ['inquiry'],
    category: 'transactional',
  }),

  // sms, chat: not declared — skipped for this event
};
```

**The plumbing** (app event infrastructure, written once) wires handler callbacks to adapter classes:

```typescript
// Infrastructure connects each handler callback to its adapter class at startup
for (const [eventType, handler] of appEventHandlers) {
  if (handler.email) {
    registerAppEvent(eventType, async (event) => {
      const handoff = await handler.email(event, ctx);
      if (!handoff) return;
      await emailAdapterClass.deliver(handoff);
      // emailAdapterClass.deliver() internally:
      //   1. Resolves target userIds → email addresses
      //   2. Checks user preferences against tags/category
      //   3. Applies rate limiting
      //   4. Logs the delivery attempt
      //   5. Fans out to ALL registered integrations (Resend, SES, Console...)
    });
  }
  // same for notify, websocket, chat, sms...
}
```

The handler author never sees this plumbing. They write callbacks that return typed handoffs. The infrastructure connects everything.

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

**Shipped (Phase 1 — PR `claude/review-tickets-3MRIU`):**
- `emitAppEvent(name, data, options?)` — typed, auto-enriches actor from `auditActorContext`
- `makeAppEvent(handler)` — returns `AppEventHandlerFn`, wired via centralized barrel
- `AppEventPayloads` map + `AppEventName` const (mirrors `JobPayloads`/`JobHandlerName`)
- Bridges: email (enqueues `sendEmail` job), websocket (targeted channels/users), observe (enqueues `recordAppEvent` job)
- `BroadcastRegistry<A>` — unified adapter primitive (pick-one or broadcast-all)
- Email registry (`lib/email.ts`): Resend + Console adapters
- Observe registry (`lib/observe.ts`): DB adapter (writes to `AppEvent` table via job)
- Bouncer email verification in `sendEmail` job (skip undeliverable/disposable)
- `EmailClient.sendBatch` — required interface, Resend chunks at 100, Console loops
- `EmailTarget` union: `userIds`, `raw`, `orgRole`, `spaceRole` with role escalation
- `InquiryHandler.appEvents` key — per-type notification callbacks (sent/approved/denied/changesRequested/resolved)
- System email template seeds: email-verification, org-invitation, welcome + shared MJML components
- `AppEvent` Prisma model — persistent event log (name, actor, resource, data)
- Transaction-aware: defers to `db.onCommit()` inside transactions
- `Promise.allSettled` in `makeAppEvent` — bridge failure isolation
- Wired into: inquiry send, inquiry resolve, BetterAuth verification, guest user creation
- `inquiry.sent` emits after auto-approve check (passes approved state if auto-approved)

**Remaining (this ticket):**

### Phase 1 Remaining
- [ ] Sender context resolution — `EmailSenderContext` flows through types but job ignores it. Need to wire `sender.ownerModel` to `composeTemplate` + `resolveFromAddress` for org-scoped templates/senders
- [ ] Template hydration strategy — currently manual per-handler. Need standard pattern for "given a template, resolve its variable dependencies"
- [ ] Unsubscribe mechanism — `CommunicationCategory` (system/promotional) is on templates. Need: preference model, unsubscribe endpoint, footer link. Review Carde patterns
- [ ] `EmailSender` + `EmailProvider` models — BYOE cascade (Space → Org → User → platform). False polymorphism pattern. Encrypted credentials like `AuthProvider`
- [ ] Rename frontend `useAppEvents` → `useWebSocket`
- [ ] Smart query invalidation — `useEventRefetch` should find the page containing the affected record, not blow away the whole cache
- [ ] Auto-connect `useWebSocketSession` hook + root layout integration
- [ ] Locale resolution — hardcoded `en`, should consult recipient preference
- [ ] Test coverage — basic tests exist, need integration tests for full pipeline

### Phase 2: Additional Bridges
- [ ] SMS bridge stub + adapter registry
- [ ] Chat bridge stub (Slack, Teams, Discord) + adapter registry
- [ ] Notify bridge (in-app notifications) — Redis-backed, WebSocket push

### Phase 3: Workflow Primitives
- [ ] Sequential steps via BullMQ job chains
- [ ] Delay step
- [ ] Skip/condition step
- [ ] Digest/batch step

### Phase 4: In-App Notifications
- [ ] Redis sorted set per user
- [ ] API endpoints (list, markRead, markAllRead, dismiss)
- [ ] Notification center UI component
- [ ] WebSocket push on create
- [ ] Preference checks via tags/category

### Phase 5: Email Delivery Tracking
- [ ] Outbound tracking pixels + link rewriting
- [ ] Inbound provider webhooks
- [ ] Delivery event storage
- [ ] Feedback as app events

### Phase 6: Optional Novu Adapter
- [ ] Map workflow definitions to `novu.trigger()`

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
