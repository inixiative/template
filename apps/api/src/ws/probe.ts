/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { WS_CHANNELS } from '@template/shared/ws';
import { app } from '#/app';
import { AUTH_PROBE_HEADER, AUTH_PROBE_SECRET } from '#/lib/utils/authProbe';
import { resolveOperationRoute } from '#/ws/operationRoute';
import { routeAccessOf } from '#/ws/routeAccess';

export type WSHeaders = Record<string, string>;

// Only credential headers may cross into internal requests; a client must never smuggle x-auth-probe.
const ALLOWED_HEADERS = new Set(['authorization', 'x-spoof-user-email']);

export const sanitizeWSHeaders = (headers: unknown): WSHeaders => {
  if (typeof headers !== 'object' || headers === null) return {};
  const out: WSHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    const name = key.toLowerCase();
    if (ALLOWED_HEADERS.has(name) && typeof value === 'string') out[name] = value;
  }
  return out;
};

export type IdentityResolution =
  | { status: 'resolved'; id: string; email: string }
  | { status: 'anonymous' }
  | { status: 'retryable' };

export const resolveIdentity = async (headers: WSHeaders): Promise<IdentityResolution> => {
  if (!headers.authorization) return { status: 'anonymous' };
  const res = await app.request('/api/v1/me', { headers });
  const access = routeAccessOf(res.status);
  if (access === 'retryable') return { status: 'retryable' };
  if (access === 'rejected') return { status: 'anonymous' };
  const body = (await res.json()) as { data?: { id?: string; email?: string } };
  return body.data?.id
    ? { status: 'resolved', id: body.data.id, email: body.data.email ?? '' }
    : { status: 'anonymous' };
};

export const canSubscribe = async (headers: WSHeaders, channel: string): Promise<boolean> => {
  const route = await resolveOperationRoute(channel);
  if (!route || !Object.hasOwn(WS_CHANNELS, route.operationId)) return false;
  const res = await app.request(route.path, {
    method: route.method,
    headers: { ...headers, [AUTH_PROBE_HEADER]: AUTH_PROBE_SECRET },
  });
  return res.ok;
};
