# INFRA-004: WebSockets - Core Event System

**Status**: 🚧 In Progress
**Assignee**: Aron
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-02-14

---

## Overview

Complete WebSocket event system with 4 core event types: feature flags, refresh triggers, notifications, and adhoc data. Every authenticated session auto-connects to WebSocket for real-time updates.

**Scope:** Infrastructure is complete. Build notification system (DB + API + UI) and wire up event handlers.

---

## Current State ✅

**Infrastructure (COMPLETE):**
- ✅ Bun native WebSocket handler (`apps/api/src/ws/`)
- ✅ JWT authentication (token via query param)
- ✅ Connection management (local + stale cleanup)
- ✅ Redis pub/sub (multi-server broadcasting)
- ✅ Channel subscription system
- ✅ Frontend hook (`useAppEvents`)
- ✅ Wildcard event handler (broadcasts to actor + resource channels)

**What exists:**
```
apps/api/src/ws/
├── auth.ts          # JWT auth
├── handler.ts       # WebSocket handlers (subscribe, ping, disconnect)
├── connections.ts   # Local connection tracking
├── pubsub.ts        # Redis cross-server broadcasting
└── types.ts         # Base types

packages/ui/src/hooks/
└── useAppEvents.ts  # Frontend WebSocket hook
```

---

## What Needs to Be Built

### 1. Auto-Connect on Session Start (1 hour)

**Goal:** Every authenticated user automatically connects to WebSocket

**Frontend:**
```typescript
// packages/ui/src/hooks/useWebSocketSession.ts (NEW)
export const useWebSocketSession = () => {
  const user = useAppStore((state) => state.auth.user);
  const token = useAppStore((state) => state.auth.token);
  const organizationId = useAppStore((state) => state.tenant.context.organization?.id);
  const spaceId = useAppStore((state) => state.tenant.context.space?.id);

  // Auto-connect when authenticated
  const { connected, subscribe } = useAppEvents({
    token,
    channels: [
      user?.id ? `user:${user.id}` : null,
      organizationId ? `org:${organizationId}` : null,
      spaceId ? `space:${spaceId}` : null,
    ].filter(Boolean) as string[],
    reconnect: true,
  });

  return { connected };
};

// Call in root layout (apps/web/app/routes/__root.tsx)
export const RootLayout = () => {
  useWebSocketSession(); // Auto-connect
  return <Outlet />;
};
```

**Tasks:**
- [ ] Create `packages/ui/src/hooks/useWebSocketSession.ts`
- [ ] Add to root layout in web/admin/superadmin apps
- [ ] Auto-subscribe to `user:${userId}`, `org:${orgId}`, `space:${spaceId}` channels

---

### 2. Event Type 1: Feature Flags (2-3 hours)

**Goal:** Real-time feature flag updates without page refresh

**Event:**
```typescript
{
  type: 'feature-flag:changed',
  data: {
    flagKey: string,
    enabled: boolean,
    scope: 'platform' | 'organization' | 'space',
    scopeId?: string,
  }
}
```

**Backend Handler:**
```typescript
// apps/api/src/events/handlers/featureFlags.ts (NEW)
import { registerAppEvent } from '#/events/registry';
import { sendToChannel } from '#/ws';

registerAppEvent('feature-flag:changed', async (event) => {
  const { scope, scopeId } = event.data;

  switch (scope) {
    case 'platform':
      broadcast(event); // All users
      break;
    case 'organization':
      sendToChannel(`org:${scopeId}`, event);
      break;
    case 'space':
      sendToChannel(`space:${scopeId}`, event);
      break;
  }
});
```

**Frontend Hook:**
```typescript
// packages/ui/src/hooks/useFeatureFlagSync.ts (NEW)
export const useFeatureFlagSync = () => {
  const refreshFlags = useAppStore((state) => state.permissions.refreshFlags);

  useAppEvents({
    onEvent: (event) => {
      if (event.type === 'feature-flag:changed') {
        refreshFlags(); // Re-fetch flags from API
      }
    },
  });
};
```

**Integration:**
```typescript
// When feature flag is updated via API:
await db.featureFlag.update({ ... });
emitAppEvent('feature-flag:changed', {
  flagKey: 'new-dashboard',
  enabled: true,
  scope: 'organization',
  scopeId: organizationId,
});
```

**Tasks:**
- [ ] Create `apps/api/src/events/handlers/featureFlags.ts`
- [ ] Create `packages/ui/src/hooks/useFeatureFlagSync.ts`
- [ ] Emit events when flags change (FEAT-003 integration)
- [ ] Test: Update flag → frontend refreshes without reload

---

### 3. Event Type 2: Refresh Triggers (2 hours)

**Goal:** Tell frontend "refetch this resource" without sending full data

**Event:**
```typescript
{
  type: 'refresh',
  data: {
    resource: 'organizations' | 'spaces' | 'users' | 'permissions' | string,
    action: 'created' | 'updated' | 'deleted',
    resourceId?: string,
  }
}
```

**Use Cases:**
- User added to organization → other org members refresh org users list
- Space settings updated → space members refresh
- Permissions changed → user refreshes permissions

**Backend:**
```typescript
// apps/api/src/events/handlers/refresh.ts (NEW)
registerAppEvent('refresh', async (event) => {
  const { resource, resourceId } = event.data;

  // Send to relevant channel based on resource type
  if (resourceId) {
    sendToChannel(`${resource}:${resourceId}`, event);
  }
});
```

**Frontend Hook:**
```typescript
// packages/ui/src/hooks/useRefreshTrigger.ts (NEW)
export const useRefreshTrigger = (
  resource: string,
  onRefresh: () => void
) => {
  useAppEvents({
    onEvent: (event) => {
      if (event.type === 'refresh' && event.data.resource === resource) {
        onRefresh();
      }
    },
  });
};

// Usage in a component:
const { refetch } = useQuery(['organizations']);
useRefreshTrigger('organizations', refetch);
```

**Tasks:**
- [ ] Create `apps/api/src/events/handlers/refresh.ts`
- [ ] Create `packages/ui/src/hooks/useRefreshTrigger.ts`
- [ ] Emit refresh events after mutations
- [ ] Test: Create org → other users see it without refresh

---

### 4. Event Type 3: Notifications (4-5 hours)

**Goal:** In-app notification system with arbitrary segment targeting, persistence, read/unread tracking, and real-time delivery

**Key Design:** Use Prisma's `where` clause for flexible, type-safe targeting

**Database Schema:**
```prisma
// packages/db/prisma/schema/notification.prisma
model Notification {
  @@map("notifications")

  id        String   @id @default(dbgenerated("uuidv7()"))
  createdAt DateTime @default(now())

  // Recipient
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Content
  title   String
  message String
  type    String @default("info") // 'info' | 'success' | 'warning' | 'error'

  // Action (optional - click to navigate)
  actionLabel String?
  actionUrl   String?

  // Metadata
  data Json? // Flexible payload for custom data

  // State
  read      Boolean  @default(false)
  readAt    DateTime?

  // Context (optional - link to resource)
  resourceType String? // 'Organization', 'Space', etc.
  resourceId   String?

  @@index([userId, read])
  @@index([userId, createdAt])
}
```

**Backend API:**
```typescript
// apps/api/src/modules/notification/routes/
// - notificationReadMany.ts   (GET /notifications - list user's notifications)
// - notificationMarkRead.ts   (PATCH /notifications/:id/read)
// - notificationMarkAllRead.ts (PATCH /notifications/read-all)
// - notificationDelete.ts     (DELETE /notifications/:id)
```

**Backend Helper (Segment Targeting):**
```typescript
// apps/api/src/lib/notifications.ts
import type { Prisma } from '@template/db';

type NotificationParams = {
  // Targeting - any valid Prisma User where clause
  where: Prisma.UserWhereInput;

  // Content
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';

  // Action
  action?: {
    label: string;
    url: string;
  };

  // Metadata
  data?: Record<string, unknown>;
  resourceType?: string;
  resourceId?: string;
};

export const createNotification = async (params: NotificationParams) => {
  const { where, title, message, type = 'info', action, data, resourceType, resourceId } = params;

  // Find matching users (segment resolution)
  const users = await db.user.findMany({
    where,
    select: { id: true },
  });

  if (users.length === 0) {
    return { count: 0, userIds: [] };
  }

  // Batch create notifications
  await db.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      title,
      message,
      type,
      actionLabel: action?.label,
      actionUrl: action?.url,
      data,
      resourceType,
      resourceId,
    })),
  });

  // Emit WebSocket events for real-time delivery
  for (const user of users) {
    sendToUser(user.id, {
      type: 'notification',
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        title,
        message,
        type,
        actionLabel: action?.label,
        actionUrl: action?.url,
        createdAt: new Date().toISOString(),
      },
    });
  }

  return { count: users.length, userIds: users.map((u) => u.id) };
};
```

**Event:**
```typescript
{
  type: 'notification',
  data: {
    id: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error',
    actionLabel?: string,
    actionUrl?: string,
    read: boolean,
    createdAt: string,
  }
}
```

**Frontend Hook:**
```typescript
// packages/ui/src/hooks/useNotifications.ts
export const useNotifications = () => {
  const userId = useAppStore((state) => state.auth.user?.id);
  const { data, refetch } = useQuery(['notifications'], () =>
    api.notifications.list()
  );

  // Listen for real-time notifications
  useAppEvents({
    onEvent: (event) => {
      if (event.type === 'notification') {
        // Show toast
        toast({
          title: event.data.title,
          description: event.data.message,
          variant: event.data.type,
        });

        // Update notifications list
        refetch();
      }
    },
  });

  const markRead = async (id: string) => {
    await api.notifications.markRead(id);
    refetch();
  };

  const markAllRead = async () => {
    await api.notifications.markAllRead();
    refetch();
  };

  const unreadCount = data?.filter(n => !n.read).length ?? 0;

  return {
    notifications: data ?? [],
    unreadCount,
    markRead,
    markAllRead,
  };
};
```

**Frontend UI Component:**
```typescript
// packages/ui/src/components/notifications/NotificationCenter.tsx
export const NotificationCenter = () => {
  const { notifications, unreadCount, markRead } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge variant="destructive">{unreadCount}</Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {notifications.map(n => (
          <NotificationItem
            key={n.id}
            notification={n}
            onRead={() => markRead(n.id)}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

**Usage Examples:**
```typescript
// Single user
await createNotification({
  where: { id: 'user-123' },
  title: 'Welcome',
  message: 'Thanks for signing up',
});

// All organization members
await createNotification({
  where: {
    organizationUsers: {
      some: { organizationId: 'org-123' },
    },
  },
  title: 'New feature released',
  message: 'Check out the new dashboard',
});

// All space members
await createNotification({
  where: {
    spaceUsers: {
      some: { spaceId: 'space-456' },
    },
  },
  title: 'Space updated',
  message: 'Settings have changed',
});

// All admins in organization
await createNotification({
  where: {
    organizationUsers: {
      some: {
        organizationId: 'org-123',
        role: 'admin',
      },
    },
  },
  title: 'Action required',
  message: 'Please review pending requests',
  action: {
    label: 'View requests',
    url: '/requests',
  },
});

// Complex segment (inactive users)
await createNotification({
  where: {
    lastLoginAt: {
      lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    organizationUsers: {
      some: { organizationId: 'org-123' },
    },
  },
  title: 'We miss you!',
  message: 'Come back and see what\'s new',
});
```

**Key Benefits:**
- ✅ **Type-safe** - Prisma types enforce valid queries
- ✅ **Flexible** - Any Prisma where clause works (single user, org, space, role, complex segments)
- ✅ **Familiar** - Developers already know Prisma syntax
- ✅ **Powerful** - Complex queries with AND, OR, nested relations
- ✅ **Simple** - No custom abstractions, just Prisma

**Tasks:**
- [ ] Create `packages/db/prisma/schema/notification.prisma`
- [ ] Create `NotificationId` typed ID
- [ ] Run `db:generate && db:push`
- [ ] Create notification factory for tests
- [ ] Create API endpoints (list, markRead, markAllRead, delete)
- [ ] Create `apps/api/src/lib/notifications.ts` helper with `where: Prisma.UserWhereInput`
- [ ] Create `packages/ui/src/hooks/useNotifications.ts`
- [ ] Create `packages/ui/src/components/notifications/NotificationCenter.tsx`
- [ ] Create `packages/ui/src/components/notifications/NotificationItem.tsx`
- [ ] Add NotificationCenter to header (web, admin, superadmin)
- [ ] Test segment targeting (single user, org, space, complex queries)
- [ ] Test real-time delivery (create notification → toast + bell update)

---

### 5. Event Type 4: Adhoc Data (1 hour)

**Goal:** Flexible event system for pushing arbitrary data (future use cases)

**Event:**
```typescript
{
  type: string, // Any custom event type
  data: Record<string, unknown>, // Flexible payload
}
```

**Examples:**
- `{ type: 'notification', data: { title, message } }`
- `{ type: 'toast', data: { message, variant } }`
- `{ type: 'user:typing', data: { conversationId, userName } }`
- `{ type: 'cache:invalidate', data: { keys: ['users', 'orgs'] } }`

**Backend:**
```typescript
// apps/api/src/events/handlers/adhoc.ts (NEW)
// Generic handler - routes based on event metadata
registerAppEvent('*', async (event) => {
  // Already handled by existing wildcard handler
  // Just ensure it works for custom event types
});
```

**Frontend:**
```typescript
// Already supported by useAppEvents
useAppEvents({
  onEvent: (event) => {
    // Handle any custom event type
    if (event.type === 'notification') {
      toast.info(event.data.title);
    }
  },
});
```

**Tasks:**
- [ ] Verify wildcard handler supports adhoc events
- [ ] Document adhoc event pattern
- [ ] Create examples (toast, notification)

---

## Implementation Plan

### Phase 1: Auto-Connect (1 hour)
- [ ] Create `useWebSocketSession` hook
- [ ] Add to root layouts (web, admin, superadmin)
- [ ] Test auto-connect on login

### Phase 2: Feature Flags (2-3 hours)
- [ ] Event handler for feature flags
- [ ] Frontend hook `useFeatureFlagSync`
- [ ] Emit events when flags change
- [ ] Test real-time flag updates

### Phase 3: Refresh Triggers (2 hours)
- [ ] Event handler for refresh triggers
- [ ] Frontend hook `useRefreshTrigger`
- [ ] Emit refresh events after mutations
- [ ] Test: mutation → other users refresh

### Phase 4: Notifications (4-5 hours)
- [ ] Database schema for notifications
- [ ] API endpoints (list, markRead, markAllRead, delete)
- [ ] Backend helper `createNotification()` with `where: Prisma.UserWhereInput` targeting
- [ ] Frontend hook `useNotifications`
- [ ] NotificationCenter component
- [ ] Add to header in all apps
- [ ] Test segment targeting (single, org, space, complex)
- [ ] Test real-time delivery + toast

### Phase 5: Adhoc Data (1 hour)
- [ ] Verify adhoc events work
- [ ] Document pattern
- [ ] Create toast/notification examples

### Phase 6: Testing & Docs (2 hours)
- [ ] Backend tests (event handlers)
- [ ] Frontend tests (hooks)
- [ ] Update `docs/claude/FRONTEND.md` with WS patterns
- [ ] Document in `docs/claude/WEBSOCKETS.md`

---

## Files to Create/Modify

### Backend - Schema
- `packages/db/prisma/schema/notification.prisma` (NEW)
- `packages/db/src/typedModelIds.ts` (MODIFY - add NotificationId)
- `packages/db/src/test/factories/notificationFactory.ts` (NEW)

### Backend - API
- `apps/api/src/modules/notification/routes/notificationReadMany.ts` (NEW)
- `apps/api/src/modules/notification/routes/notificationMarkRead.ts` (NEW)
- `apps/api/src/modules/notification/routes/notificationMarkAllRead.ts` (NEW)
- `apps/api/src/modules/notification/routes/notificationDelete.ts` (NEW)
- `apps/api/src/lib/notifications.ts` (NEW - createNotification helper)

### Backend - Events
- `apps/api/src/events/handlers/featureFlags.ts` (NEW)
- `apps/api/src/events/handlers/refresh.ts` (NEW)
- `apps/api/src/events/handlers/notifications.ts` (NEW)
- `apps/api/src/events/index.ts` (MODIFY - import handlers)

### Frontend - Hooks
- `packages/ui/src/hooks/useWebSocketSession.ts` (NEW)
- `packages/ui/src/hooks/useFeatureFlagSync.ts` (NEW)
- `packages/ui/src/hooks/useRefreshTrigger.ts` (NEW)
- `packages/ui/src/hooks/useNotifications.ts` (NEW)
- `packages/ui/src/hooks/index.ts` (MODIFY - export hooks)

### Frontend - Components
- `packages/ui/src/components/notifications/NotificationCenter.tsx` (NEW)
- `packages/ui/src/components/notifications/NotificationItem.tsx` (NEW)
- `packages/ui/src/components/layout/Header.tsx` (MODIFY - add NotificationCenter)

### Frontend - Apps
- `apps/web/app/routes/__root.tsx` (MODIFY - add useWebSocketSession)
- `apps/admin/app/routes/__root.tsx` (MODIFY - add useWebSocketSession)
- `apps/superadmin/app/routes/__root.tsx` (MODIFY - add useWebSocketSession)

### Docs
- `docs/claude/WEBSOCKETS.md` (NEW)
- `docs/claude/FRONTEND.md` (UPDATE - add WS section)

---

## Success Criteria

- ✅ Every authenticated session auto-connects to WebSocket
- ✅ Feature flag changes instantly reflect in UI (no refresh)
- ✅ Refresh triggers notify clients to refetch data
- ✅ Notifications stored in DB with read/unread tracking
- ✅ Arbitrary segment targeting via Prisma where clause (type-safe, flexible)
- ✅ Real-time notification delivery (toast + bell update)
- ✅ Notification center in header (all apps)
- ✅ Batch notifications to org/space/role/custom segments
- ✅ Adhoc events support custom use cases
- ✅ Auto-subscribe to user/org/space channels
- ✅ Comprehensive tests
- ✅ Documentation complete

---

## Estimated Time

**Total: 12-15 hours** (~2 days)

- Auto-connect: 1 hour
- Feature flags: 2-3 hours
- Refresh triggers: 2 hours
- Notifications: 4-5 hours
- Adhoc data: 1 hour
- Testing & docs: 2 hours

---

## Dependencies

**Blocked by:** None - infrastructure complete!
**Blocks:** FEAT-003 (Feature Flags ⭐)

---

## Design Notes

### Why `where: Prisma.UserWhereInput`?

**Notification** = in-app channel only (DB + WebSocket)
**AppEvent** = multi-channel coordinator (in-app + email + SMS + push)

Using Prisma's where clause for targeting:
- ✅ Type-safe (Prisma enforces valid queries)
- ✅ Flexible (any segment: user, org, space, role, custom)
- ✅ Familiar (developers already know Prisma)
- ✅ Powerful (complex AND/OR queries, nested relations)
- ✅ Simple (no custom abstractions)

**Example Flow:**
```typescript
// AppEvent coordinates multi-channel
emitAppEvent('user.invited', { userId, orgId, inviterName });

// Event handler uses createNotification for in-app
registerAppEvent('user.invited', async (event) => {
  // In-app notification (segment targeting)
  await createNotification({
    where: { id: event.userId },
    title: 'New invitation',
    message: `${event.inviterName} invited you`,
  });

  // Email (COMM-001 - future)
  await sendEmail({ to: event.userId, template: 'invited' });
});
```

---

## Related Tickets

- **FEAT-003**: Feature Flags (needs real-time updates)
- **COMM-001**: Email System (multi-channel notifications)
