/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { resolveIdentity } from '#/ws/probe';
import { byId } from '#/ws/registry';
import { rejectDataStream } from '#/ws/rejectDataStream';
import type { RouteAccess } from '#/ws/routeAccess';
import { reprobeStreamAccess } from '#/ws/streamProbe';
import type { WSSocket } from '#/ws/types';

// A spoof whose caller lost superadmin silently falls through to the caller, so the probe alone can't see it.
const spoofAccess = async (ws: WSSocket): Promise<RouteAccess> => {
  if (!ws.data.headers['x-spoof-user-email']) return 'granted';
  const identity = await resolveIdentity(ws.data.headers);
  if (identity.status === 'retryable') return 'retryable';
  return identity.status === 'resolved' && identity.id === ws.data.userId ? 'granted' : 'rejected';
};

const streamAccess = (ws: WSSocket, stream: string): Promise<RouteAccess> =>
  reprobeStreamAccess(ws.data.headers, stream).catch((): RouteAccess => 'retryable');

export const reauthorizeStreams = async (ws: WSSocket): Promise<void> => {
  const identityAccess = await spoofAccess(ws).catch((): RouteAccess => 'retryable');
  for (const stream of [...ws.data.streams]) {
    const access = identityAccess === 'granted' ? await streamAccess(ws, stream) : identityAccess;
    if (!byId.has(ws.data.connectionId)) return;
    if (access !== 'granted' && ws.data.streams.has(stream)) rejectDataStream(ws, stream, access);
  }
};
