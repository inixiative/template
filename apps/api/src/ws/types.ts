/**
 * @atlas
 * @kind type
 * @partOf primitive:websockets
 * @uses primitive:shared
 */
import type { SerializedQueue } from '@template/shared/utils';
import type { ServerWebSocket } from 'bun';

export type WSData = {
  connectionId: string; // unique per connection (multiple tabs = multiple ids)
  userId: string | null; // effective identity: real, or spoofed-as; null = anonymous
  headers: Record<string, string>; // the credential behind `userId`, shaped as the HTTP surface expects
  channels: Set<string>; // subscribed channels (normalized query keys)
  connectedAt: number;
  lastPing: number; // staleness detection
  queue: SerializedQueue; // serializes this connection's async message handling
};

// Inbound: FE → BE, one per frame. authenticate carries credential headers exactly as an HTTP
// request would (authorization, x-spoof-user-email); spoofing is just a header.
export type WSMessage =
  | { action: 'authenticate'; headers: Record<string, string> }
  | { action: 'logout' }
  | { action: 'subscribe'; channel: string }
  | { action: 'unsubscribe'; channel: string }
  | { action: 'ping' };

export type WSSocket = ServerWebSocket<WSData>;

// Wire format for outbound websocket messages. Opaque to the transport — the
// producer (appEvent ws bridge, etc.) decides the fields the frontend sees.
export type WSOutbound = Record<string, unknown>;
