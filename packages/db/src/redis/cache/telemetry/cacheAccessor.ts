/**
 * @atlas
 * @kind utils
 * @partOf primitive:caching, infrastructure:observability
 * @uses none
 */
export const cacheAccessor = (key: string): string => key.split(':')[1] ?? 'unknown';
