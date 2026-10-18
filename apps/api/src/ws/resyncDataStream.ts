/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses primitive:shared
 */
import type { WSStreamResyncFrame } from '@template/shared/ws';
import { sendTo } from '#/ws/delivery';
import { unsubscribeFromStream } from '#/ws/streamSubscriptions';
import type { WSSocket } from '#/ws/types';

// Not a failure: the holder drops its last seq and re-opens at once for a fresh snapshot.
export const resyncDataStream = (ws: WSSocket, stream: string): void => {
  unsubscribeFromStream(ws, stream);
  const frame: WSStreamResyncFrame = { type: 'resync', stream };
  sendTo(ws, frame);
};
