/**
 * @atlas
 * @kind helper
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { StreamDefinition, StreamOp, StreamOpPayload, StreamParams } from '@template/shared/ws';
import type { WSStreamAppendHandoff } from '#/appEvents/types';
import type { ValidatedStreamAppend } from '#/appEvents/validatedStreamAppend';

type AppendOptions = { revive?: boolean };

type Options<D extends StreamDefinition> = D['audience'] extends 'perRecipient'
  ? [options: AppendOptions & { userIds: string[] }]
  : [options?: AppendOptions];

export const streamAppend = <D extends StreamDefinition, K extends StreamOp<D>>(
  definition: D,
  params: StreamParams<D>,
  type: K,
  payload: StreamOpPayload<D, K>,
  ...[options]: Options<D>
): WSStreamAppendHandoff => {
  const userIds = options && 'userIds' in options ? options.userIds : undefined;
  return {
    kind: 'stream',
    target: { stream: definition.name(params), ...(userIds ? { userIds } : {}) },
    append: { type, payload, ...(options?.revive ? { revive: true } : {}) } as unknown as ValidatedStreamAppend,
  };
};
