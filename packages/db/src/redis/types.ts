/**
 * @atlas
 * @kind type
 * @partOf infrastructure:redis
 * @uses none
 */
import type { Redis } from 'ioredis';

export type RedisEval = Pick<Redis, 'eval'>;
