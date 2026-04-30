import type { ServerWebSocket } from 'bun';

export type WSData = {
  connectionId: string; // Unique per connection (multiple tabs = multiple IDs)
  userId: string | null; // Null for anonymous connections
  channels: Set<string>;
  connectedAt: number;
  lastPing: number; // For staleness detection
};

export type WSMessage =
  | { action: 'subscribe'; channel: string }
  | { action: 'unsubscribe'; channel: string }
  | { action: 'ping' }
  | { action: 'disconnect' }; // Explicit cleanup from FE

export type WSSocket = ServerWebSocket<WSData>;

// Wire format for outbound websocket messages. The shape is opaque to the
// transport layer — handlers in #/appEvents/handlers decide what fields the
// frontend will see (typically `event` + handler-specific data).
export type AppEventPayload = Record<string, unknown>;
