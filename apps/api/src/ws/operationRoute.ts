/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses primitive:routeTemplates
 */
import { channelKey, parseChannelKey } from '@template/shared/ws';
import { app } from '#/app';

export type OperationRoute = { operationId: string; method: string; path: string };

const DOT_SEGMENTS = new Set(['.', '..']);

let operations: Map<string, { method: string; path: string }> | null = null;

const loadOperations = async (): Promise<Map<string, { method: string; path: string }>> => {
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

export const resolveOperationRoute = async (name: string): Promise<OperationRoute | null> => {
  if (typeof name !== 'string') return null;
  const key = parseChannelKey(name);
  if (channelKey(key) !== name) return null;
  const op = (await loadOperations()).get(key._id);
  if (!op) return null;

  let path = op.path;
  for (const [field, value] of Object.entries(key.path ?? {})) {
    if (DOT_SEGMENTS.has(String(value))) return null;
    const filled = encodeURIComponent(String(value));
    const next = path.replace(`{${field}}`, filled).replace(`:${field}`, filled);
    if (next === path) return null;
    path = next;
  }
  if (path.includes('{') || path.includes('/:')) return null;
  return { operationId: key._id, method: op.method, path };
};
