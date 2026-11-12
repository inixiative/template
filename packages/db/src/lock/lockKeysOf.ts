/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:redis, mutex
 * @uses none
 */
import { lockKeyOf } from '@template/db/lock/lockKeyOf';
import type { LockSetTarget, LockTarget } from '@template/db/lock/types';

// The keys a lock holds, each built by lockKeyOf, so a set and a single-identifier lock on the same
// identifier contend on exactly the same Redis key. Sorted, so two sets always take their shared
// keys in the same order. An empty list is refused: a lock on nothing has no key to fence.
export const lockKeysOf = (target: LockTarget | LockSetTarget): [string, ...string[]] => {
  if (!('identifiers' in target)) return [lockKeyOf(target)];
  const [first, ...rest] = [...new Set(target.identifiers)]
    .sort()
    .map((identifier) => lockKeyOf({ service: target.service, identifier }));
  if (first === undefined) throw new Error('createLock: identifiers must name at least one key');
  return [first, ...rest];
};
