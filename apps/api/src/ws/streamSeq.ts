/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import { redisNamespace } from '@template/db';

export const STREAM_SEQ_TTL_MS = 24 * 60 * 60 * 1000;

export const streamSeqKey = (stream: string): string => `${redisNamespace.ws}:seq:${stream}`;

// Clock-seeded so a counter re-created after expiry starts above its old values: holders see a gap.
export const streamSeqSeed = (): string => String(Date.now() * 1000);
