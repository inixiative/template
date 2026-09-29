/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses none
 */
import { byStream, deindexFrom, indexInto } from '#/ws/registry';
import type { WSSocket } from '#/ws/types';

export const subscribeToStream = (ws: WSSocket, stream: string): void => {
  ws.data.streams.add(stream);
  indexInto(byStream, stream, ws.data.connectionId);
};

export const unsubscribeFromStream = (ws: WSSocket, stream: string): void => {
  ws.data.streams.delete(stream);
  ws.data.heldAppends.delete(stream);
  deindexFrom(byStream, stream, ws.data.connectionId);
};
