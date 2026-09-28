/**
 * @atlas
 * @kind helper
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { StreamDefinition, StreamOp, StreamOpPayload, StreamParams } from '@template/shared/ws';
import type { RouteRow } from '#/appEvents/routeRow';
import type { WSStreamAppendHandoff } from '#/appEvents/types';
import type { ValidatedStreamAppend } from '#/appEvents/validatedStreamAppend';

type Payload<D extends StreamDefinition, K extends StreamOp<D>> = K extends 'upsert'
  ? RouteRow<StreamOpPayload<D, K>>
  : StreamOpPayload<D, K>;

type ReviveOption<K> = K extends 'upsert' ? { revive?: boolean } : { revive?: never };

type Options<D extends StreamDefinition, K> = D['audience'] extends 'shared'
  ? [options?: ReviveOption<K>]
  : [options: ReviveOption<K> & { userIds: string[] }];

export const streamAppend = <D extends StreamDefinition, K extends StreamOp<D>>(
  definition: D,
  params: StreamParams<D>,
  type: K,
  payload: Payload<D, K>,
  ...[options]: Options<D, K>
): WSStreamAppendHandoff => {
  const userIds = options && 'userIds' in options ? options.userIds : undefined;
  if (definition.audience === 'perRecipient' && !userIds) {
    throw new Error(`streamAppend: perRecipient stream ${definition.family} requires userIds`);
  }
  return {
    kind: 'stream',
    target: { stream: definition.name(params), ...(userIds ? { userIds } : {}) },
    append: { type, payload, ...(options?.revive ? { revive: true } : {}) } as unknown as ValidatedStreamAppend,
  };
};
