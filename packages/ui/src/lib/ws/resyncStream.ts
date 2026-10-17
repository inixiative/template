/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import { useAppStore } from '@template/ui/store';

export const resyncStream = (stream: string, reason: string): void => {
  console.error(`ws stream ${stream}: ${reason}; requesting a fresh snapshot`);
  useAppStore.getState().websocket.resync(stream);
};
