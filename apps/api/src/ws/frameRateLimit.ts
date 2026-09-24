/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses primitive:shared
 */
import { WS_FRAME_LIMIT, WS_FRAME_WINDOW_MS } from '@template/shared/ws';
import type { WSSocket } from '#/ws/types';

const frameWindows = new WeakMap<WSSocket, { start: number; count: number }>();

export const overFrameLimit = (ws: WSSocket): boolean => {
  const now = Date.now();
  const window = frameWindows.get(ws);
  if (!window || now - window.start > WS_FRAME_WINDOW_MS) {
    frameWindows.set(ws, { start: now, count: 1 });
    return false;
  }
  window.count++;
  return window.count > WS_FRAME_LIMIT;
};
