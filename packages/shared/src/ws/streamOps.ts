/**
 * @atlas
 * @kind type
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import type { StreamDefinition } from '@template/shared/ws/defineStream';

export type StreamRow = { id: string };

export type VersionedStreamRow = StreamRow & { updatedAt: Date | string };

export type StreamOrdering = 'updatedAt' | 'arrival';

export type StreamOps<O extends StreamOrdering = StreamOrdering> = {
  list: { upsert: O extends 'arrival' ? StreamRow : VersionedStreamRow; remove: StreamRow };
  log: { append: unknown };
};

export type StreamKind = keyof StreamOps;

export type StreamOp<D extends StreamDefinition> = keyof StreamOps<D['ordering']>[D['kind']] &
  string;

export type StreamOpPayload<D extends StreamDefinition, K extends StreamOp<D>> = StreamOps<
  D['ordering']
>[D['kind']][K];
