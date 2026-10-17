/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses primitive:routeTemplates
 */
import { channelKey, parseChannelKey } from '@template/shared/ws';
import { type ResolvedOperation, resolveOperation } from '#/lib/openapi/resolveOperation';

export const resolveOperationRoute = async (name: string): Promise<ResolvedOperation | null> => {
  if (typeof name !== 'string') return null;
  const key = parseChannelKey(name);
  if (channelKey(key) !== name) return null;
  return resolveOperation(key._id, key.path ?? {});
};
