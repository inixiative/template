/**
 * @atlas
 * @kind utils
 * @partOf primitive:websockets
 * @uses none
 */
import {
  addConnectionIdToIndex,
  connectionIdsByChannel,
  removeConnectionIdFromIndex,
} from '#/ws/registry';
import type { WSSocket } from '#/ws/types';

// channel = a normalized query key (opaque string here). The connection's own
// `channels` set and the connectionIdsByChannel reverse-index are two halves of one fact —
// both mutate together so delivery + cleanup stay consistent.
export const subscribeToChannel = (ws: WSSocket, channel: string): void => {
  ws.data.channels.add(channel);
  addConnectionIdToIndex(connectionIdsByChannel, channel, ws.data.connectionId);
};

export const unsubscribeFromChannel = (ws: WSSocket, channel: string): void => {
  ws.data.channels.delete(channel);
  removeConnectionIdFromIndex(connectionIdsByChannel, channel, ws.data.connectionId);
};
