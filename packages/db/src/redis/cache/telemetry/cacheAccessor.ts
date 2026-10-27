/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching, infrastructure:observability
 * @uses none
 */
// The accessor segment, never the key: cacheKey interpolates ids after it, so a key-tagged metric
// would be unbounded cardinality.
export const cacheAccessor = (key: string): string => key.split(':')[1] ?? 'unknown';
