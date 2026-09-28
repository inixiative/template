/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses primitive:shared
 */
import type { WSFrameErrorFrame } from '@template/shared/ws';
import type { WSMessage } from '#/ws/types';

export const frameError = (msg: WSMessage): WSFrameErrorFrame => ({
  type: 'error',
  action: msg.action,
  retryable: true,
  ...('stream' in msg && typeof msg.stream === 'string' ? { stream: msg.stream } : {}),
  ...('channel' in msg && typeof msg.channel === 'string' ? { channel: msg.channel } : {}),
});
