/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { parseChannelKey, WS_CHANNELS } from '@template/shared/ws';

// Injected at boot (index.ts) and by tests — importing the app here would drag the full route
// graph into every ws unit test.
type ProbeApp = { request: (path: string, init?: RequestInit) => Promise<Response> | Response };
let probeApp: ProbeApp | null = null;
let operations: Map<string, { method: string; path: string }> | null = null;

export const setProbeApp = (app: ProbeApp): void => {
  probeApp = app;
  operations = null;
};

// operationId → route, from the app's own OpenAPI document.
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

// A query channel IS its query: subscribing is authorized by probing the operation's route with
// the connection's credential — 2xx over HTTP means the caller may watch it. The route's own
// middleware chain is the only authorizer, so tightening a route tightens its channel.
export const canSubscribe = async (token: string | null, channel: string): Promise<boolean> => {
  if (!probeApp) throw new Error('WS probe app not set — call setProbeApp at boot');
  const key = parseChannelKey(channel);
  if (!(key._id in WS_CHANNELS)) return false;
  const op = (await loadOperations(probeApp)).get(key._id);
  if (!op) return false;

  // Docs emit `{param}` (OpenAPI) or `:param` (Hono) depending on route registration — fill both.
  let path = op.path;
  for (const [field, value] of Object.entries(key.path ?? {})) {
    const filled = encodeURIComponent(String(value));
    path = path.replace(`{${field}}`, filled).replace(`:${field}`, filled);
  }
  if (path.includes('{') || path.includes('/:')) return false; // a param the channel key doesn't carry

  const headers: Record<string, string> = { 'x-auth-probe': '1' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await probeApp.request(path, { method: op.method, headers });
  return res.ok;
};
