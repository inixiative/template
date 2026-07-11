/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { parseChannelKey, WS_CHANNELS } from '@template/shared/ws';
import { AUTH_PROBE_HEADER, AUTH_PROBE_SECRET } from '#/lib/utils/authProbe';

// The connection's credential: the same headers an HTTP request would carry.
export type WSHeaders = Record<string, string>;

// Only credential headers cross from the socket into internal requests — a client must never
// smuggle x-auth-probe or anything else.
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

type ProbeApp = { request: (path: string, init?: RequestInit) => Promise<Response> | Response };
let probeApp: ProbeApp | null = null;
let operations: Map<string, { method: string; path: string }> | null = null;

// The real app, loaded lazily — probes ARE requests, in tests too.
const getProbeApp = async (): Promise<ProbeApp> => {
  if (!probeApp) {
    const { app } = await import('#/app');
    probeApp = { request: (path, init) => app.fetch(new Request(`http://internal${path}`, init)) };
  }
  return probeApp;
};

// Identity is provenance of the credential: /me through the API's own auth + spoof middleware.
export const resolveIdentity = async (headers: WSHeaders): Promise<{ id: string; email: string } | null> => {
  if (!headers.authorization) return null;
  const app = await getProbeApp();
  const res = await app.request('/api/v1/me', { headers });
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
export const canSubscribe = async (headers: WSHeaders, channel: string): Promise<boolean> => {
  const app = await getProbeApp();
  const key = parseChannelKey(channel);
  if (!(key._id in WS_CHANNELS)) return false;
  const op = (await loadOperations(app)).get(key._id);
  if (!op) return false;

  let path = op.path;
  for (const [field, value] of Object.entries(key.path ?? {})) {
    const filled = encodeURIComponent(String(value));
    const next = path.replace(`{${field}}`, filled).replace(`:${field}`, filled);
    if (next === path) return false; // surplus segment — not a param of this route
    path = next;
  }
  if (path.includes('{') || path.includes('/:')) return false;

  const res = await app.request(path, {
    method: op.method,
    headers: { ...headers, [AUTH_PROBE_HEADER]: AUTH_PROBE_SECRET },
  });
  return res.ok;
};
