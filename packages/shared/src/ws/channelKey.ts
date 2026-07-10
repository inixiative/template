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
