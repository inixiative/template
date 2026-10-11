/**
 * @atlas
 * @kind query
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import { STREAM_SEQ_TTL_MS, streamSeqKey, streamSeqSeed } from '#/ws/streamSeq';

const READ_SEQ =
  "redis.call('SET', KEYS[1], ARGV[1], 'NX') redis.call('PEXPIRE', KEYS[1], ARGV[2]) return redis.call('GET', KEYS[1])";

type EvalCapable = {
  eval: (script: string, numKeys: number, ...args: (string | number)[]) => Promise<unknown>;
};

export const readStreamSeq = async (redis: EvalCapable, stream: string): Promise<number> =>
  Number(
    await redis.eval(READ_SEQ, 1, streamSeqKey(stream), streamSeqSeed(), String(STREAM_SEQ_TTL_MS)),
  );
