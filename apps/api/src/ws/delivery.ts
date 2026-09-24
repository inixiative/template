/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses none
 */
import { byChannel, byId, byStream, byUser, removeConnection } from '#/ws/registry';
import type { WSOutbound, WSSocket } from '#/ws/types';

// Local delivery to THIS instance's sockets. pubsub re-injects remote emits here.
//
// Snapshot the id set before iterating: a dead socket triggers removeConnection,
// which mutates the very set being delivered to. readyState guards stand in for
// try/catch — a closed socket is removed, not sent to.
const sendOrEvict = (ws: WSSocket, message: string): void => {
  if (ws.readyState === WebSocket.OPEN) ws.send(message);
  else removeConnection(ws);
};

const deliver = (connectionIds: Set<string>, message: string, send = sendOrEvict): void => {
  for (const id of [...connectionIds]) {
    const ws = byId.get(id);
    // Backstop: an id in a reverse-index but gone from byId is stale — drop it so a missed deindex can't leak.
    if (!ws) {
      connectionIds.delete(id);
      continue;
    }
    send(ws, message);
  }
};

export const sendTo = (ws: WSSocket, event: WSOutbound): void => {
  ws.send(JSON.stringify(event));
};

export const sendToChannelLocal = (channel: string, event: WSOutbound): void => {
  const ids = byChannel.get(channel);
  if (ids) deliver(ids, JSON.stringify(event));
};

export const sendToStreamLocal = (stream: string, event: WSOutbound): void => {
  const ids = byStream.get(stream);
  if (!ids) return;
  deliver(ids, JSON.stringify(event), (ws, message) => {
    const held = ws.data.heldAppends.get(stream);
    if (held) held.push(message);
    else sendOrEvict(ws, message);
  });
};

export const sendToUserLocal = (userId: string, event: WSOutbound): void => {
  const ids = byUser.get(userId);
  if (ids) deliver(ids, JSON.stringify(event));
};

export const broadcastLocal = (event: WSOutbound): void => {
  deliver(new Set(byId.keys()), JSON.stringify(event));
};
