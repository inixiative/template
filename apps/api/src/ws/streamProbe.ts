/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { SYSTEM_PROBE_SECRET } from '#/lib/utils/authProbe';
import { probeRouteAccess, type WSHeaders } from '#/ws/probe';
import type { RouteAccess } from '#/ws/routeAccess';
import { resolveStreamRoute } from '#/ws/streamRoute';

export const reprobeStreamAccess = async (
  headers: WSHeaders,
  stream: string,
): Promise<RouteAccess> => {
  const resolved = await resolveStreamRoute(stream);
  return probeRouteAccess(resolved?.route ?? null, headers, SYSTEM_PROBE_SECRET);
};
