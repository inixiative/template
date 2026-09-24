/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import { getRedisPub, getRedisSub } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { streamAppendFrame } from '#/ws/dataFrame';
import { broadcastLocal, sendToChannelLocal, sendToStreamLocal, sendToUserLocal } from '#/ws/delivery';
import { inStreamOrder } from '#/ws/streamPublishOrder';
import type { WSOutbound } from '#/ws/types';

const WS_CHANNEL = 'ws:broadcast';

type PubSubMessage = {
  type: 'user' | 'channel' | 'stream' | 'broadcast';
  target?: string;
  userIds?: string[];
  event: WSOutbound;
};

export type StreamAppend = { type: string; payload: unknown };

let initialized = false;
let pubsubEnabled = false;

const deliverLocal = ({ type, target, userIds, event }: PubSubMessage): void => {
  switch (type) {
    case 'user':
      if (target) sendToUserLocal(target, event);
      break;
    case 'channel':
      if (target) sendToChannelLocal(target, event);
      break;
    case 'stream':
      if (target) sendToStreamLocal(target, event, userIds);
      break;
    case 'broadcast':
      broadcastLocal(event);
      break;
  }
};

// Only socket-holding processes subscribe; publishers (the job worker too) always publish through Redis.
export const initWebSocketPubSub = async (): Promise<void> => {
  if (initialized) return;

  try {
    const sub = getRedisSub();
    await sub.subscribe(WS_CHANNEL);

    sub.on('message', (channel, message) => {
      if (channel !== WS_CHANNEL) return;

      try {
        deliverLocal(JSON.parse(message) as PubSubMessage);
      } catch (err) {
        log.error('Failed to process pub/sub message:', err);
      }
    });

    pubsubEnabled = true;
    // Only a successful subscription marks init done — a failure leaves it retryable.
    initialized = true;
    log.info('Pub/Sub Enabled', LogScope.ws);
  } catch (err) {
    log.warn('⚠️ WebSocket pub/sub disabled (Redis unavailable):', err);
    pubsubEnabled = false;
  }
};

const publish = async (message: PubSubMessage): Promise<void> => {
  try {
    await getRedisPub().publish(WS_CHANNEL, JSON.stringify(message));
  } catch (err) {
    log.error('Failed to publish to Redis:', err);
    deliverLocal(message);
  }
};

export const sendToUser = (userId: string, event: WSOutbound): Promise<void> =>
  publish({ type: 'user', target: userId, event });

export const sendToChannel = (channel: string, event: WSOutbound): Promise<void> =>
  publish({ type: 'channel', target: channel, event });

// Serialized per stream so this instance publishes a stream's appends in emission order, fallback included.
export const appendToStream = (stream: string, append: StreamAppend, userIds?: string[]): Promise<void> =>
  inStreamOrder(stream, () =>
    publish({ type: 'stream', target: stream, userIds, event: streamAppendFrame(stream, append.type, append.payload) }),
  );

export const broadcast = (event: WSOutbound): Promise<void> => publish({ type: 'broadcast', event });

export const isPubSubEnabled = (): boolean => {
  return pubsubEnabled;
};
