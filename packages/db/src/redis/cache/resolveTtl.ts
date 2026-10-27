/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching
 * @uses none
 */
import { isNil } from 'lodash-es';

// Null and undefined results get a short TTL so newly created records are discovered quickly.
const NEGATIVE_TTL = 60;

export const resolveTtl = <T>(value: T, ttl: number | ((value: T) => number)): number => {
  if (isNil(value)) return NEGATIVE_TTL;
  return typeof ttl === 'function' ? ttl(value) : ttl;
};
