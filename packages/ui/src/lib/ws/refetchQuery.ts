/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { WSQueryEvent } from '@template/shared/ws';
import { useAppStore } from '@template/ui/store';

export const refetchQuery = (event: WSQueryEvent): void => {
  useAppStore.getState().client?.invalidateQueries({ queryKey: [event.key] });
};
