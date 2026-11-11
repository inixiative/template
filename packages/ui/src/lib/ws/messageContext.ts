/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses none
 */
import type { QueryClient } from '@tanstack/react-query';

// What the websocket client hands each inbound-message handler: the cache the app reads from, and
// the client's own way to ask for a fresh snapshot of a stream.
export type MessageContext = {
  client: QueryClient | null;
  resync: (stream: string) => void;
};
