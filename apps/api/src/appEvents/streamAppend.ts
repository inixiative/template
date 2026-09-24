/**
 * @atlas
 * @kind helper
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { StreamActionInput, StreamActionType, StreamDefinition, StreamParams } from '@template/shared/ws';
import type { WSStreamAppendHandoff } from '#/appEvents/types';
import type { ValidatedStreamAppend } from '#/appEvents/validatedStreamAppend';

type Recipients<D extends StreamDefinition> = D['audience'] extends 'perRecipient' ? [userIds: string[]] : [];

export const streamAppend = <D extends StreamDefinition, K extends StreamActionType<D>>(
  definition: D,
  params: StreamParams<D>,
  type: K,
  payload: StreamActionInput<D, K>,
  ...[userIds]: Recipients<D>
): WSStreamAppendHandoff => ({
  target: { stream: definition.name(params), ...(userIds ? { userIds } : {}) },
  append: {
    type,
    payload: (definition.actions[type] as D['actions'][K]).parse(payload),
  } as unknown as ValidatedStreamAppend,
});
