/**
 * @atlas
 * @kind query
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import type { RedisEval } from '@template/db';
import { STREAM_SEQ_TTL_MS } from '#/ws/streamSeq';

// One script so publish order is seq order across instances; GET keeps each seq out of Lua's %.14g.
// A new counter is seeded from Redis TIME (µs), one clock for every instance, so it starts above old seqs.
const PUBLISH_WITH_SEQS = `local now = redis.call('TIME') local seed = now[1] .. string.format('%06d', tonumber(now[2])) local seqs = {} for i, key in ipairs(KEYS) do redis.call('SET', key, seed, 'NX') redis.call('INCR', key) redis.call('PEXPIRE', key, ARGV[3]) seqs[i] = redis.call('GET', key) end local joined = table.concat(seqs, ',') redis.call('PUBLISH', ARGV[1], '{"seqs":[' .. joined .. '],' .. string.sub(ARGV[2], 2)) return joined`;

export const publishStreamAppend = async (
  redis: RedisEval,
  channel: string,
  seqKeys: string[],
  message: Record<string, unknown>,
): Promise<number[]> => {
  const joined = (await redis.eval(
    PUBLISH_WITH_SEQS,
    seqKeys.length,
    ...seqKeys,
    channel,
    JSON.stringify(message),
    String(STREAM_SEQ_TTL_MS),
  )) as string;
  return joined.split(',').map(Number);
};
