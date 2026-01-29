# App Events

## Contents

- [Overview](#overview)
- [Event System](#event-system)
- [WebSockets](#websockets)
- [Communications (Stub)](#communications-stub)
- [Analytics/Data (Stub)](#analyticsdata-stub)

---

## Overview

App events are high-level business events (separate from DB hooks). Use for:
- Real-time notifications via WebSocket
- Email/SMS communications
- Analytics tracking (Segment, etc.)
- Cross-service messaging

---

## Event System

Located in `apps/api/src/events/`.

### Emitting Events

```typescript
import { createAppEvent } from '#/events/emit';

await createAppEvent('user.signedUp', { userId, email }, {
  actorId: userId,
  resourceType: 'User',
  resourceId: userId,
});
```

If called inside a transaction, handlers run on commit.

### Registering Handlers

```typescript
import { registerAppEvent } from '#/events/registry';

// Handle specific event
registerAppEvent('user.signedUp', async (event) => {
  // Send welcome email, track analytics, etc.
});

// Handle all events (use '*')
registerAppEvent('*', async (event) => {
  // Log to analytics service
});
```

### Event Types

Base types defined in `apps/api/src/events/types.ts`:

```typescript
type BaseAppEventType = 'user.signedUp' | 'user.verified' | 'user.updated';
```

Add new event types as needed. Format: `{resource}.{action}`

### Event Payload

```typescript
type AppEventPayload = {
  type: AppEventType;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  data: Record<string, unknown>;
  timestamp: string;
};
```

---

## WebSockets

Located in `apps/api/src/ws/`. Redis pub/sub for multi-instance support.

### Connection

```
ws://localhost:8000/ws
```

Authentication via session cookie (optional - anonymous allowed).

### Client Messages

```typescript
// Subscribe to channel
{ "action": "subscribe", "channel": "org:abc123" }

// Unsubscribe
{ "action": "unsubscribe", "channel": "org:abc123" }

// Keepalive
{ "action": "ping" }

// Explicit disconnect
{ "action": "disconnect" }
```

### Server Messages

```typescript
// Connection established
{ "type": "connected", "connectionId": "...", "userId": "..." }

// Subscription confirmed
{ "type": "subscribed", "channel": "org:abc123" }

// Broadcast message
{ "type": "message", "channel": "org:abc123", "data": {...} }

// Pong response
{ "type": "pong", "timestamp": 1234567890 }
```

### Publishing from Server

```typescript
import { publishToChannel } from '#/ws/pubsub';

await publishToChannel('org:abc123', {
  type: 'resource.updated',
  data: { ... },
});
```

### WebSocket Handler

Core WebSocket logic in `apps/api/src/ws/`:

| File | Purpose |
|------|---------|
| `handler.ts` | Connection lifecycle, message handling |
| `connections.ts` | Connection/channel tracking |
| `pubsub.ts` | Redis pub/sub for multi-instance |
| `auth.ts` | Session authentication |

### Broadcasting App Events (Pattern)

To broadcast app events over WebSocket:

```typescript
// events/handlers/websocket.ts (create this)
registerAppEvent('*', async (event) => {
  if (event.resourceType && event.resourceId) {
    await publishToChannel(`${event.resourceType}:${event.resourceId}`, event);
  }
});
```

### Connection Management

- Stale connections cleaned every 60s
- Ping/pong for keepalive
- Per-connection channel subscriptions

---

## Communications (Stub)

> TODO: Add email/notification integrations

### Planned

- **Email**: Resend, SendGrid, or SES
- **Push Notifications**: Firebase, OneSignal
- **SMS**: Twilio

### Pattern

```typescript
// Example structure
registerAppEvent('user.signedUp', async (event) => {
  await sendEmail({
    to: event.data.email,
    template: 'welcome',
    data: { name: event.data.name },
  });
});
```

---

## Analytics/Data (Stub)

> TODO: Add analytics/data lake integrations

### Planned

- **Segment**: Track events, identify users
- **Mixpanel/Amplitude**: Product analytics
- **Data Lake**: S3 + Athena, BigQuery

### Pattern

```typescript
// Example structure
registerAppEvent('*', async (event) => {
  await analytics.track({
    userId: event.actorId,
    event: event.type,
    properties: event.data,
    timestamp: event.timestamp,
  });
});
```
