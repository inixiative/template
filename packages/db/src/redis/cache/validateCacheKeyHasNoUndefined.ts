/**
 * @atlas
 * @kind validator
 * @partOf primitive:caching
 * @uses none
 */
export const validateCacheKeyHasNoUndefined = (key: string): void => {
  if (key.includes('undefined')) {
    throw new Error(`Cache key contains 'undefined': ${key}`);
  }
};
