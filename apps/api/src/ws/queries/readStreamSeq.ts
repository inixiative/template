/**
 * @atlas
 * @kind query
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import type { RedisEval } from '@template/db';
import { STREAM_SEQ_TTL_MS } from '#/ws/streamSeq';

const READ_SEQ = `local now = redis.call('TIME') local seed = now[1] .. string.format('%06d', tonumber(now[2])) redis.call('SET', KEYS[1], seed, 'NX') redis.call('PEXPIRE', KEYS[1], ARGV[1]) return redis.call('GET', KEYS[1])`;

export const readStreamSeq = async (redis: RedisEval, seqKey: string): Promise<number> =>
  Number(await redis.eval(READ_SEQ, 1, seqKey, String(STREAM_SEQ_TTL_MS)));
