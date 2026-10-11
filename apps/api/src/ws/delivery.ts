/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses none
 */
import { byChannel, byId, byStream, byUser, removeConnection } from '#/ws/registry';
import type { WSOutbound, WSSocket } from '#/ws/types';

// Bun returns 0 for a dropped frame; closing makes the client reconnect and resync instead of drift.
export const sendFrame = (ws: WSSocket, message: string): void => {
  if (ws.send(message) !== 0) return;
  if (ws.readyState === WebSocket.OPEN) ws.close(1013, 'frame dropped');
  removeConnection(ws);
};

const sendOrEvict = (ws: WSSocket, message: string): void => {
  if (ws.readyState === WebSocket.OPEN) sendFrame(ws, message);
  else removeConnection(ws);
};

// Iterates a copy: evicting a dead socket mutates the very index being delivered to.
const deliver = (connectionIds: Set<string>, message: string, send = sendOrEvict): void => {
  for (const id of [...connectionIds]) {
    const ws = byId.get(id);
    if (!ws) {
      connectionIds.delete(id);
      continue;
    }
    send(ws, message);
  }
};

export const sendTo = (ws: WSSocket, event: WSOutbound): void => {
  sendFrame(ws, JSON.stringify(event));
};

export const sendToChannelLocal = (channel: string, event: WSOutbound): void => {
  const ids = byChannel.get(channel);
  if (ids) deliver(ids, JSON.stringify(event));
};

export const sendToStreamLocal = (stream: string, event: WSOutbound, userIds?: string[]): void => {
  const ids = byStream.get(stream);
  if (!ids) return;
  deliver(ids, JSON.stringify(event), (ws, message) => {
    if (userIds && !(ws.data.userId && userIds.includes(ws.data.userId))) return;
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
