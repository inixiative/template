/**
 * @atlas
 * @kind query
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import type { RedisEval } from '@template/db';
import type { StreamSeqRead } from '#/ws/queries/readStreamSeq';
import { STREAM_SEQ_TTL_MS } from '#/ws/streamSeq';

// A counter absent at the read is seeded with that read only if still absent; 0 means another
// append or open created it in between, so the read cannot stamp a snapshot.
const CLAIM_SEQ = `if ARGV[3] == '1' then redis.call('PEXPIRE', KEYS[1], ARGV[2]) return 1 end if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then return 1 end return 0`;

export const claimStreamSeq = async (
  redis: RedisEval,
  seqKey: string,
  { seq, counted }: StreamSeqRead,
): Promise<boolean> =>
  (await redis.eval(
    CLAIM_SEQ,
    1,
    seqKey,
    String(seq),
    String(STREAM_SEQ_TTL_MS),
    counted ? '1' : '0',
  )) === 1;
