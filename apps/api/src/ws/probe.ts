/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { parseChannelKey, WS_CHANNELS } from '@template/shared/ws';
import type { WSData } from '#/ws/types';

// Injected at boot — a direct app import would drag the route graph into every ws unit test.
type ProbeApp = { request: (path: string, init?: RequestInit) => Promise<Response> | Response };
let probeApp: ProbeApp | null = null;
let operations: Map<string, { method: string; path: string }> | null = null;

export const setProbeApp = (app: ProbeApp): void => {
  probeApp = app;
  operations = null;
};

const getProbeApp = (): ProbeApp => {
  if (!probeApp) throw new Error('WS probe app not set — call setProbeApp at boot');
  return probeApp;
};

export type WSCredential = Pick<WSData, 'token' | 'spoofEmail'>;

const credentialHeaders = (credential: WSCredential): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (credential.token) headers.authorization = `Bearer ${credential.token}`;
  if (credential.spoofEmail) headers['x-spoof-user-email'] = credential.spoofEmail;
  return headers;
};

// Identity is provenance of the credential: /me through the API's own auth + spoof middleware.
export const resolveIdentity = async (credential: WSCredential): Promise<{ id: string; email: string } | null> => {
  if (!credential.token) return null;
  const res = await getProbeApp().request('/api/v1/me', { headers: credentialHeaders(credential) });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { id?: string; email?: string } };
  return body.data?.id ? { id: body.data.id, email: body.data.email ?? '' } : null;
};

const loadOperations = async (app: ProbeApp): Promise<Map<string, { method: string; path: string }>> => {
  if (operations) return operations;
  const doc = (await (await app.request('/openapi/docs')).json()) as unknown as {
    paths?: Record<string, Record<string, { operationId?: string }>>;
  };
  operations = new Map();
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (op?.operationId) operations.set(op.operationId, { method: method.toUpperCase(), path });
    }
  }
  return operations;
};

// A query channel is authorized by its own route: probe the operation with the connection's
// credential — 2xx over HTTP means the caller may watch it.
export const canSubscribe = async (credential: WSCredential, channel: string): Promise<boolean> => {
  const app = getProbeApp();
  const key = parseChannelKey(channel);
  if (!(key._id in WS_CHANNELS)) return false;
  const op = (await loadOperations(app)).get(key._id);
  if (!op) return false;

  let path = op.path;
  for (const [field, value] of Object.entries(key.path ?? {})) {
    const filled = encodeURIComponent(String(value));
    path = path.replace(`{${field}}`, filled).replace(`:${field}`, filled);
  }
  if (path.includes('{') || path.includes('/:')) return false;

  const res = await app.request(path, {
    method: op.method,
    headers: { ...credentialHeaders(credential), 'x-auth-probe': '1' },
  });
  return res.ok;
};
