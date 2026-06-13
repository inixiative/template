/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import stringify from 'safe-stable-stringify';

const defaultKeyBy = (x: unknown): unknown => {
  if (x === null || typeof x !== 'object') return x;
  return stringify(x);
};

export const containsAny = <T>(a: Iterable<T>, b: Iterable<T>, keyBy: (x: T) => unknown = defaultKeyBy): boolean => {
  const seen = new Set<unknown>();
  for (const x of a) seen.add(keyBy(x));
  for (const x of b) if (seen.has(keyBy(x))) return true;
  return false;
};
