/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { app } from '#/app';
import type { WSHeaders } from '#/ws/probe';
import { type RouteAccess, routeAccessOf } from '#/ws/routeAccess';
import { resolveStreamRoute } from '#/ws/streamRoute';

export type StreamRead = { access: 'granted'; payload: unknown } | { access: Exclude<RouteAccess, 'granted'> };

// Not a probe: the route runs, and its 2xx body is both the authorization and the snapshot.
export const fetchStreamSnapshot = async (headers: WSHeaders, stream: string): Promise<StreamRead> => {
  const resolved = await resolveStreamRoute(stream);
  if (!resolved) return { access: 'rejected' };
  const res = await app.request(resolved.route.path, { headers });
  const access = routeAccessOf(res.status);
  if (access !== 'granted') return { access };
  return { access, payload: await res.json() };
};
