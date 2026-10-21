/**
 * @atlas
 * @kind query
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import type { RedisEval } from '@template/db';

export type StreamSeqRead = { seq: number; counted: boolean };

// Writes nothing: an open is not yet authorized here. An absent counter reads as Redis TIME (µs).
const READ_SEQ = `local held = redis.call('GET', KEYS[1]) if held then return {1, held} end local now = redis.call('TIME') return {0, now[1] .. string.format('%06d', tonumber(now[2]))}`;

export const readStreamSeq = async (redis: RedisEval, seqKey: string): Promise<StreamSeqRead> => {
  const [counted, seq] = (await redis.eval(READ_SEQ, 1, seqKey)) as [number, string];
  return { seq: Number(seq), counted: counted === 1 };
};
