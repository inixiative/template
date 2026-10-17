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
// The {stream} hash tag keeps one append's recipient keys in one Redis Cluster slot.
export const streamSeqKey = (stream: string, userId?: string | null): string =>
  userId
    ? `${redisNamespace.ws}:seq:{${stream}}:user:${userId}`
    : `${redisNamespace.ws}:seq:{${stream}}`;

const isPerRecipient = (audience: StreamAudience | undefined): boolean =>
  audience === 'perRecipient';

export const streamSeqKeyFor = (stream: string, userId: string | null): string =>
  streamSeqKey(stream, isPerRecipient(streamDefinitionOf(stream)?.audience) ? userId : null);
