/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { app } from '#/app';
import { AUTH_PROBE_HEADER, SYSTEM_PROBE_SECRET } from '#/lib/utils/authProbe';
import type { WSHeaders } from '#/ws/probe';
import { type RouteAccess, routeAccessOf } from '#/ws/routeAccess';
import { resolveStreamRoute } from '#/ws/streamRoute';

export const reprobeStreamAccess = async (headers: WSHeaders, stream: string): Promise<RouteAccess> => {
  const resolved = await resolveStreamRoute(stream);
  if (!resolved) return 'rejected';
  const res = await app.request(resolved.route.path, {
    method: resolved.route.method,
    headers: { ...headers, [AUTH_PROBE_HEADER]: SYSTEM_PROBE_SECRET },
  });
  return routeAccessOf(res.status);
};
