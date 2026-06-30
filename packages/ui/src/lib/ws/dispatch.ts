/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:shared
 */
import type { WSEvent } from '@template/shared/ws';
import { useAppStore } from '@template/ui/store';

const handlers = {
  query: {
    refetch: (event: WSEvent) => {
      useAppStore.getState().client?.invalidateQueries({ queryKey: [event.key] });
    },
  },
};

export const dispatchMessage = (event: WSEvent): void => {
  handlers[event.category]?.[event.action]?.(event);
};
