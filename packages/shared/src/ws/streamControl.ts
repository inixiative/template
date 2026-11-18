/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
export type WSStreamAckFrame = { type: 'opened' | 'openRejected' | 'closed'; stream: string };

export type WSStreamResyncFrame = { type: 'resync'; stream: string };

export type WSFrameErrorFrame = {
  type: 'error';
  action: string;
  stream?: string;
  channel?: string;
  retryable: boolean;
};

export const retryableErrorFrame = (message: {
  action: string;
  stream?: unknown;
  channel?: unknown;
}): WSFrameErrorFrame => ({
  type: 'error',
  action: message.action,
  retryable: true,
  ...(typeof message.stream === 'string' ? { stream: message.stream } : {}),
  ...(typeof message.channel === 'string' ? { channel: message.channel } : {}),
});
