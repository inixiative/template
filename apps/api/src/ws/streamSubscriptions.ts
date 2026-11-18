/**
 * @atlas
 * @kind utils
 * @partOf primitive:websockets
 * @uses none
 */
import {
  addConnectionIdToIndex,
  connectionIdsByStream,
  removeConnectionIdFromIndex,
} from '#/ws/registry';
import type { WSSocket } from '#/ws/types';

export const subscribeToStream = (ws: WSSocket, stream: string): void => {
  ws.data.streams.add(stream);
  addConnectionIdToIndex(connectionIdsByStream, stream, ws.data.connectionId);
};

export const unsubscribeFromStream = (ws: WSSocket, stream: string): void => {
  ws.data.streams.delete(stream);
  ws.data.heldAppends.delete(stream);
  removeConnectionIdFromIndex(connectionIdsByStream, stream, ws.data.connectionId);
};
