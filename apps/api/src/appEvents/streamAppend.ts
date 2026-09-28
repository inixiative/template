/**
 * @atlas
 * @kind helper
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { StreamDefinition, StreamOp, StreamOpPayload, StreamParams } from '@template/shared/ws';
import type { WSStreamAppendHandoff } from '#/appEvents/types';
import type { ValidatedStreamAppend } from '#/appEvents/validatedStreamAppend';

type Recipients<D extends StreamDefinition> = D['audience'] extends 'perRecipient' ? [userIds: string[]] : [];

export const streamAppend = <D extends StreamDefinition, K extends StreamOp<D>>(
  definition: D,
  params: StreamParams<D>,
  type: K,
  payload: StreamOpPayload<D, K>,
  ...[userIds]: Recipients<D>
): WSStreamAppendHandoff => ({
  kind: 'stream',
  target: { stream: definition.name(params), ...(userIds ? { userIds } : {}) },
  append: { type, payload } as unknown as ValidatedStreamAppend,
});
