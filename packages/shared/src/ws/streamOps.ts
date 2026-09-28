/**
 * @atlas
 * @kind type
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import type { StreamDefinition } from '@template/shared/ws/defineStream';

export type StreamRow = { id: string };

export type StreamOps = {
  list: { upsert: StreamRow; remove: StreamRow };
  log: { append: unknown };
};

export type StreamKind = keyof StreamOps;

export type StreamOp<D extends StreamDefinition> = keyof StreamOps[D['kind']] & string;

export type StreamOpPayload<D extends StreamDefinition, K extends StreamOp<D>> = StreamOps[D['kind']][K];
