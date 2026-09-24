/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { app } from '#/app';
import { resolveChannelRoute, type WSHeaders } from '#/ws/probe';

export type StreamSnapshot = { payload: unknown };

// Not a probe: the route runs, and its 2xx body is both the authorization and the snapshot.
export const fetchStreamSnapshot = async (headers: WSHeaders, stream: string): Promise<StreamSnapshot | null> => {
  const route = await resolveChannelRoute(stream, 'stream');
  if (route?.method !== 'GET') return null;
  const res = await app.request(route.path, { headers });
  if (!res.ok) return null;
  return { payload: await res.json() };
};
