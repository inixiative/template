/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses none
 */
import { byUser, deindexFrom, indexInto } from '#/ws/registry';
import { unsubscribeFromStream } from '#/ws/streamSubscriptions';
import { unsubscribeFromChannel } from '#/ws/subscriptions';
import type { WSSocket } from '#/ws/types';

// authenticate / spoof / unspoof / logout all resolve to this: set the effective
// identity and re-index byUser. A single userId holds the effective identity
// (real, or spoofed-as); unspoof re-authenticates to restore the real user.
//
// Sync — async token validation happens in the handler before calling this.
export const setIdentity = (ws: WSSocket, userId: string | null): void => {
  const prev = ws.data.userId;
  if (prev === userId) return;
  if (prev) deindexFrom(byUser, prev, ws.data.connectionId);
  // Channel subscriptions and open streams were authorized under the previous identity — drop them
  // on any identity change; the client resubscribes and re-opens under the new one.
  for (const channel of [...ws.data.channels]) unsubscribeFromChannel(ws, channel);
  for (const stream of [...ws.data.streams]) unsubscribeFromStream(ws, stream);
  ws.data.userId = userId;
  if (userId) indexInto(byUser, userId, ws.data.connectionId);
};
