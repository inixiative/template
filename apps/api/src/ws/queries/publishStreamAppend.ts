/**
 * @atlas
 * @kind query
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import { STREAM_SEQ_TTL_MS, streamSeqKey, streamSeqSeed } from '#/ws/streamSeq';

// One script so publish order is seq order across instances; GET keeps the seq out of Lua's %.14g.
const PUBLISH_WITH_SEQ =
  "redis.call('SET', KEYS[1], ARGV[3], 'NX') redis.call('INCR', KEYS[1]) redis.call('PEXPIRE', KEYS[1], ARGV[4]) local seq = redis.call('GET', KEYS[1]) redis.call('PUBLISH', ARGV[1], '{\"seq\":' .. seq .. ',' .. string.sub(ARGV[2], 2)) return seq";

type EvalCapable = {
  eval: (script: string, numKeys: number, ...args: (string | number)[]) => Promise<unknown>;
};

export const publishStreamAppend = async (
  redis: EvalCapable,
  channel: string,
  stream: string,
  message: Record<string, unknown>,
): Promise<number> =>
  Number(
    await redis.eval(
      PUBLISH_WITH_SEQ,
      1,
      streamSeqKey(stream),
      channel,
      JSON.stringify(message),
      streamSeqSeed(),
      String(STREAM_SEQ_TTL_MS),
    ),
  );
