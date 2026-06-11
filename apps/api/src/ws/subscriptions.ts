/**
 * @atlas
 * @partOf primitive:websockets
 */
import { byChannel, deindexFrom, indexInto } from '#/ws/registry';
import type { WSSocket } from '#/ws/types';

// channel = a normalized query key (opaque string here). The connection's own
// `channels` set and the byChannel reverse-index are two halves of one fact —
// both mutate together so delivery + cleanup stay consistent.
export const subscribeToChannel = (ws: WSSocket, channel: string): void => {
  ws.data.channels.add(channel);
  indexInto(byChannel, channel, ws.data.connectionId);
};

export const unsubscribeFromChannel = (ws: WSSocket, channel: string): void => {
  ws.data.channels.delete(channel);
  deindexFrom(byChannel, channel, ws.data.connectionId);
};
