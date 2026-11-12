/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import { streamDefinitionOf, type WSStreamAppendEvent } from '@template/shared/ws';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import type { MessageContext } from '@template/ui/lib/ws/messageContext';
import { streamFoldFor } from '@template/ui/lib/ws/streamFolds';
import { notifyStreamListeners } from '@template/ui/lib/ws/streamListeners';

export const applyStreamAppend = (
  event: WSStreamAppendEvent,
  { client, resync }: MessageContext,
): void => {
  const definition = streamDefinitionOf(event.stream);
  if (!definition) return;
  const { ops } = streamFoldFor(definition.kind);
  const fold = Object.hasOwn(ops, event.type) ? ops[event.type] : undefined;
  if (!fold) {
    console.error(
      `ws stream ${event.stream}: unknown ${definition.kind} op ${event.type}; requesting a fresh snapshot`,
    );
    resync(event.stream);
    return;
  }

  client?.setQueryData(dataStreamQueryKey(event.stream), (state: unknown) =>
    state === undefined
      ? undefined
      : fold(state, event.payload, { revive: event.revive, ordering: definition.ordering }),
  );
  notifyStreamListeners(event.stream, event.type, event.payload);
};
