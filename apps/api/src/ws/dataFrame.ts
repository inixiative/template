/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses primitive:shared
 */
import type { WSDataEvent } from '@template/shared/ws';

export const dataFrame = (action: WSDataEvent['action'], stream: string, payload: unknown): WSDataEvent => ({
  category: 'data',
  action,
  stream,
  payload,
});
