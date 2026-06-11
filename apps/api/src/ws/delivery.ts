/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses none
 */
import { byChannel, byId, byUser, removeConnection } from '#/ws/registry';
import type { WSOutbound } from '#/ws/types';

// Local delivery to THIS instance's sockets. pubsub re-injects remote emits here.
//
// Snapshot the id set before iterating: a dead socket triggers removeConnection,
// which mutates the very set being delivered to. readyState guards stand in for
// try/catch — a closed socket is removed, not sent to.
const deliver = (connectionIds: Set<string>, message: string): void => {
  for (const id of [...connectionIds]) {
    const ws = byId.get(id);
    if (!ws) continue;
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
    else removeConnection(ws);
  }
};

export const sendToChannelLocal = (channel: string, event: WSOutbound): void => {
  const ids = byChannel.get(channel);
  if (ids) deliver(ids, JSON.stringify(event));
};

export const sendToUserLocal = (userId: string, event: WSOutbound): void => {
  const ids = byUser.get(userId);
  if (ids) deliver(ids, JSON.stringify(event));
};

export const broadcastLocal = (event: WSOutbound): void => {
  deliver(new Set(byId.keys()), JSON.stringify(event));
};
