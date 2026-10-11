/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import { redisNamespace } from '@template/db';
import { type StreamAudience, streamDefinitionOf } from '@template/shared/ws';

export const STREAM_SEQ_TTL_MS = 24 * 60 * 60 * 1000;

// A perRecipient stream counts per user: an append another user never receives must not be a gap.
export const streamSeqKey = (stream: string, userId?: string | null): string =>
  userId
    ? `${redisNamespace.ws}:seq:${stream}:user:${userId}`
    : `${redisNamespace.ws}:seq:${stream}`;

const isPerRecipient = (audience: StreamAudience | undefined): boolean =>
  audience === 'perRecipient';

export const streamSeqKeyFor = (stream: string, userId: string | null): string =>
  streamSeqKey(stream, isPerRecipient(streamDefinitionOf(stream)?.audience) ? userId : null);

// Clock-seeded so a counter re-created after expiry starts above its old values: holders see a gap.
export const streamSeqSeed = (): string => String(Date.now() * 1000);
