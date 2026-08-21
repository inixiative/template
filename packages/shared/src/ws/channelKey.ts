/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
export type ChannelKeyInput = { _id: string; path?: Record<string, unknown> | null };

// Mirrors cacheKey serialization (packages/db redis/cache.ts): route identity, then path scope
// flattened to sorted field:value pairs. query/headers/body are dropped so list variants share one channel.
export const channelKey = ({ _id, path }: ChannelKeyInput): string => {
  if (!path) return _id;
  const idParts = Object.entries(path)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([field, value]) => [field, String(value)]);
  return [_id, ...idParts].join(':');
};

// Inverse of channelKey — the field:value interleaving makes channel names invertible, which is
// what lets the server resolve a subscription back to the route it stands for.
export const parseChannelKey = (channel: string): ChannelKeyInput => {
  const [_id = '', ...parts] = channel.split(':');
  if (parts.length === 0) return { _id };
  const path: Record<string, string> = {};
  for (let i = 0; i + 1 < parts.length; i += 2) path[parts[i] as string] = parts[i + 1] as string;
  return { _id, path };
};
