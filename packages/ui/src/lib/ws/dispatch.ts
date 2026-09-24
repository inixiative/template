/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { WSEvent, WSQueryEvent, WSStreamAppendEvent, WSStreamSnapshotEvent } from '@template/shared/ws';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import { failDataStream } from '@template/ui/lib/ws/failDataStream';
import { streamDefinitionOf } from '@template/ui/lib/ws/streamDefinitionOf';
import { notifyStreamListeners } from '@template/ui/lib/ws/streamListeners';
import { streamRebaseFor, streamReducerFor } from '@template/ui/lib/ws/streamReducers';
import { useAppStore } from '@template/ui/store';

type Handlers = {
  [C in WSEvent['category']]: {
    [A in Extract<WSEvent, { category: C }>['action']]: (event: Extract<WSEvent, { category: C; action: A }>) => void;
  };
};

const resync = (stream: string, reason: string): void => {
  console.error(`ws stream ${stream}: ${reason}; requesting a fresh snapshot`);
  useAppStore.getState().websocket.resync(stream);
};

const applySnapshot = (event: WSStreamSnapshotEvent): void => {
  const definition = streamDefinitionOf(event.stream);
  if (!definition) return;
  const parsed = definition.snapshot.safeParse(event.payload);
  if (!parsed.success) {
    console.error(`ws stream ${event.stream}: snapshot failed validation`, parsed.error);
    failDataStream(event.stream, 'failed');
    return;
  }
  const rebase = streamRebaseFor(event.stream);
  useAppStore
    .getState()
    .client?.setQueryData(dataStreamQueryKey(event.stream), (previous: unknown) =>
      previous === undefined || !rebase ? parsed.data : rebase(previous, parsed.data),
    );
};

const applyAppend = (event: WSStreamAppendEvent): void => {
  const definition = streamDefinitionOf(event.stream);
  if (!definition) return;
  const schema = Object.hasOwn(definition.actions, event.type)
    ? definition.actions[event.type as keyof typeof definition.actions]
    : null;
  const parsed = schema?.safeParse(event.payload);
  if (!parsed?.success) {
    resync(event.stream, schema ? `${event.type} failed validation` : `unknown action ${event.type}`);
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

const handlers: Handlers = {
  query: {
    refetch: (event: WSQueryEvent) => {
      useAppStore.getState().client?.invalidateQueries({ queryKey: [event.key] });
    },
  },
  data: {
    snapshot: applySnapshot,
    append: applyAppend,
  },
};

export const dispatchMessage = (event: WSEvent): void => {
  const byAction = handlers[event.category] as Record<string, (event: WSEvent) => void> | undefined;
  byAction?.[event.action]?.(event);
};
