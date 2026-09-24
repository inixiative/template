/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses primitive:shared
 */
import type { WSFrameErrorFrame, WSStreamAckFrame } from '@template/shared/ws';
import { sendTo } from '#/ws/delivery';
import type { RouteAccess } from '#/ws/routeAccess';
import { unsubscribeFromStream } from '#/ws/streamSubscriptions';
import type { WSSocket } from '#/ws/types';

export const rejectDataStream = (ws: WSSocket, stream: string, access: Exclude<RouteAccess, 'granted'>): void => {
  unsubscribeFromStream(ws, stream);
  const frame: WSStreamAckFrame | WSFrameErrorFrame =
    access === 'rejected'
      ? { type: 'openRejected', stream }
      : { type: 'error', action: 'open', stream, retryable: true };
  sendTo(ws, frame);
};
