/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { WSQueryEvent } from '@template/shared/ws';
import type { MessageContext } from '@template/ui/lib/ws/messageContext';

export const refetchQuery = (event: WSQueryEvent, { client }: MessageContext): void => {
  client?.invalidateQueries({ queryKey: [event.key] });
};
