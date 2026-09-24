/**
 * @atlas
 * @kind type
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
export type WSStreamAckFrame = { type: 'opened' | 'openRejected' | 'closed'; stream: string };

export type WSFrameErrorFrame = {
  type: 'error';
  action: string;
  stream?: string;
  channel?: string;
  retryable: boolean;
};
