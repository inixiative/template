/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import { getRedisPub, getRedisSub } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { dataFrame } from '#/ws/dataFrame';
import { broadcastLocal, sendToChannelLocal, sendToStreamLocal, sendToUserLocal } from '#/ws/delivery';
import type { WSOutbound } from '#/ws/types';

const WS_CHANNEL = 'ws:broadcast';

type PubSubMessage = {
  type: 'user' | 'channel' | 'stream' | 'broadcast';
  target?: string;
  event: WSOutbound;
};

let initialized = false;
let pubsubEnabled = false;

const deliverLocal = ({ type, target, event }: PubSubMessage): void => {
  switch (type) {
    case 'user':
      if (target) sendToUserLocal(target, event);
      break;
    case 'channel':
      if (target) sendToChannelLocal(target, event);
      break;
    case 'stream':
      if (target) sendToStreamLocal(target, event);
      break;
    case 'broadcast':
      broadcastLocal(event);
      break;
  }
};

// Socket-holding processes (the API server) call this at boot to receive cross-instance
// fan-out. Publishers (including the job worker, which holds no sockets) don't need it —
// publish always goes through Redis.
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

// Returned promises let callers (the appEvents websocket channel) await delivery so failures
// surface through the channel's allSettled isolation instead of escaping unhandled.
export const sendToUser = (userId: string, event: WSOutbound): Promise<void> =>
  publish({ type: 'user', target: userId, event });

export const sendToChannel = (channel: string, event: WSOutbound): Promise<void> =>
  publish({ type: 'channel', target: channel, event });

export const appendToStream = (stream: string, payload: unknown): Promise<void> =>
  publish({ type: 'stream', target: stream, event: dataFrame('append', stream, payload) });

export const broadcast = (event: WSOutbound): Promise<void> => publish({ type: 'broadcast', event });

export const isPubSubEnabled = (): boolean => {
  return pubsubEnabled;
};
