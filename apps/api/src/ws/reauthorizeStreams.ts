/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { byId } from '#/ws/registry';
import { rejectDataStream } from '#/ws/rejectDataStream';
import type { RouteAccess } from '#/ws/routeAccess';
import { reprobeStreamAccess } from '#/ws/streamProbe';
import type { WSSocket } from '#/ws/types';

const streamAccess = (ws: WSSocket, stream: string): Promise<RouteAccess> =>
  reprobeStreamAccess(ws.data.headers, stream).catch((): RouteAccess => 'retryable');

export const reauthorizeStreams = async (ws: WSSocket): Promise<void> => {
  for (const stream of [...ws.data.streams]) {
    const access = await streamAccess(ws, stream);
    if (!byId.has(ws.data.connectionId)) return;
    if (access !== 'granted' && ws.data.streams.has(stream)) rejectDataStream(ws, stream, access);
  }
};
