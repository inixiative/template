/**
 * @atlas
 * @kind utils
 * @partOf primitive:caching
 * @uses none
 */
export const isCacheKeyPattern = (key: string): boolean => key.includes('*');
