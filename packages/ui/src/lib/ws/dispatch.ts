/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { WSEvent } from '@template/shared/ws';
import { applyStreamAppend } from '@template/ui/lib/ws/applyStreamAppend';
import { applyStreamSnapshot } from '@template/ui/lib/ws/applyStreamSnapshot';
import { refetchQuery } from '@template/ui/lib/ws/refetchQuery';

type Handlers = {
  [C in WSEvent['category']]: {
    [A in Extract<WSEvent, { category: C }>['action']]: (
      event: Extract<WSEvent, { category: C; action: A }>,
    ) => void;
  };
};

const handlers: Handlers = {
  query: { refetch: refetchQuery },
  data: { snapshot: applyStreamSnapshot, append: applyStreamAppend },
};

export const dispatchMessage = (event: WSEvent): void => {
  const byAction = handlers[event.category] as Record<string, (event: WSEvent) => void> | undefined;
  byAction?.[event.action]?.(event);
};
