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

export type AppEventPayload = {
  type: string;
  [key: string]: unknown;
};
