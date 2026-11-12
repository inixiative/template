/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching
 * @uses none
 */
import { isNil } from 'lodash-es';

const NEGATIVE_TTL = 60;

export const resolveTtl = <T>(value: T, ttl: number | ((value: T) => number)): number => {
  if (isNil(value)) return NEGATIVE_TTL;
  return typeof ttl === 'function' ? ttl(value) : ttl;
};
