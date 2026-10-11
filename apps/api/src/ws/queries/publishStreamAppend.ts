/**
 * @atlas
 * @kind query
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import { STREAM_SEQ_TTL_MS, streamSeqSeed } from '#/ws/streamSeq';

// One script so publish order is seq order across instances; GET keeps each seq out of Lua's %.14g.
const PUBLISH_WITH_SEQS =
  "local seqs = {} for i, key in ipairs(KEYS) do redis.call('SET', key, ARGV[3], 'NX') redis.call('INCR', key) redis.call('PEXPIRE', key, ARGV[4]) seqs[i] = redis.call('GET', key) end local joined = table.concat(seqs, ',') redis.call('PUBLISH', ARGV[1], '{\"seqs\":[' .. joined .. '],' .. string.sub(ARGV[2], 2)) return joined";

type EvalCapable = {
  eval: (script: string, numKeys: number, ...args: (string | number)[]) => Promise<unknown>;
};

export const publishStreamAppend = async (
  redis: EvalCapable,
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
    streamSeqSeed(),
    String(STREAM_SEQ_TTL_MS),
  )) as string;
  return joined.split(',').map(Number);
};
