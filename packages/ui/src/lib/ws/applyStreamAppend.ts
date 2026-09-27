/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { WSStreamAppendEvent } from '@template/shared/ws';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import { resyncStream } from '@template/ui/lib/ws/resyncStream';
import { streamDefinitionOf } from '@template/ui/lib/ws/streamDefinitionOf';
import { notifyStreamListeners } from '@template/ui/lib/ws/streamListeners';
import { streamReducerFor } from '@template/ui/lib/ws/streamReducers';
import { useAppStore } from '@template/ui/store';

export const applyStreamAppend = (event: WSStreamAppendEvent): void => {
  const definition = streamDefinitionOf(event.stream);
  if (!definition) return;
  const schema = Object.hasOwn(definition.actions, event.type)
    ? definition.actions[event.type as keyof typeof definition.actions]
    : null;
  const parsed = schema?.safeParse(event.payload);
  if (!parsed?.success) {
    resyncStream(event.stream, schema ? `${event.type} failed validation` : `unknown action ${event.type}`);
    return;
  }

  const reduce = streamReducerFor(event.stream, event.type);
  if (reduce) {
    useAppStore
      .getState()
      .client?.setQueryData(dataStreamQueryKey(event.stream), (state: unknown) =>
        state === undefined ? undefined : reduce(state, parsed.data),
      );
  }
  notifyStreamListeners(event.stream, event.type, parsed.data);
};
