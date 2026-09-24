/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { WSDataEvent, WSEvent, WSQueryEvent } from '@template/shared/ws';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import { dataStreamReducer } from '@template/ui/lib/ws/dataStreamReducers';
import { useAppStore } from '@template/ui/store';

type Handlers = {
  [C in WSEvent['category']]: {
    [A in Extract<WSEvent, { category: C }>['action']]: (event: Extract<WSEvent, { category: C }>) => void;
  };
};

const handlers: Handlers = {
  query: {
    refetch: (event: WSQueryEvent) => {
      useAppStore.getState().client?.invalidateQueries({ queryKey: [event.key] });
    },
  },
  data: {
    snapshot: (event: WSDataEvent) => {
      useAppStore.getState().client?.setQueryData(dataStreamQueryKey(event.stream), event.payload);
    },
    append: (event: WSDataEvent) => {
      const reduce = dataStreamReducer(event.stream);
      if (!reduce) return;
      useAppStore
        .getState()
        .client?.setQueryData(dataStreamQueryKey(event.stream), (snapshot: unknown) =>
          snapshot === undefined ? undefined : reduce(snapshot, event.payload),
        );
    },
  },
};

export const dispatchMessage = (event: WSEvent): void => {
  const byAction = handlers[event.category] as Record<string, (event: WSEvent) => void> | undefined;
  byAction?.[event.action]?.(event);
};
