/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses none
 */
import { byUser, deindexFrom, indexInto } from '#/ws/registry';
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
  // Channel subscriptions were made under the previous identity — drop them on any identity
  // change; the client resubscribes under the new one.
  for (const channel of [...ws.data.channels]) unsubscribeFromChannel(ws, channel);
  ws.data.userId = userId;
  if (userId) indexInto(byUser, userId, ws.data.connectionId);
};
