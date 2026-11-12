/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:redis, mutex
 * @uses none
 */
import type { LockTarget } from '@template/db/lock/types';
import { redisNamespace } from '@template/db/redis/namespaces';

export const lockKeyOf = (target: LockTarget): string =>
  'key' in target ? target.key : `${redisNamespace.lock}:${target.service}:${target.identifier}`;
