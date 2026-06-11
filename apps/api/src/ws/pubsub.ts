/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
// @wip — cross-server WebSocket pub/sub layer not yet finalized.
// Known TODOs for the next pass:
//   - Three duplicate switches on `type` (init handler, fallback in publish,
//     redis-error fallback in publish) should collapse into one `Record<type, fn>`
//     once the message contract is stable.
//   - Redis-unavailable fallback is duplicated with the redis-error fallback.

import { getRedisPub, getRedisSub } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { broadcastLocal, sendToChannelLocal, sendToUserLocal } from '#/ws/delivery';
import type { WSOutbound } from '#/ws/types';

const WS_CHANNEL = 'ws:broadcast';

type PubSubMessage = {
  type: 'user' | 'channel' | 'broadcast';
  target?: string;
  event: WSOutbound;
};

let initialized = false;
let pubsubEnabled = false;

export const initWebSocketPubSub = async (): Promise<void> => {
  if (initialized) return;
  initialized = true;

  try {
    const sub = getRedisSub();
    await sub.subscribe(WS_CHANNEL);

    sub.on('message', (channel, message) => {
      if (channel !== WS_CHANNEL) return;

      try {
        const { type, target, event } = JSON.parse(message) as PubSubMessage;

        switch (type) {
          case 'user':
            if (target) sendToUserLocal(target, event);
            break;
          case 'channel':
            if (target) sendToChannelLocal(target, event);
            break;
          case 'broadcast':
            broadcastLocal(event);
            break;
        }
      } catch (err) {
        log.error('Failed to process pub/sub message:', err);
      }
    });

    pubsubEnabled = true;
    log.info('Pub/Sub Enabled', LogScope.ws);
  } catch (err) {
    log.warn('⚠️ WebSocket pub/sub disabled (Redis unavailable):', err);
    pubsubEnabled = false;
  }
};

const publish = async (message: PubSubMessage): Promise<void> => {
  if (!pubsubEnabled) {
    switch (message.type) {
      case 'user':
        if (message.target) sendToUserLocal(message.target, message.event);
        break;
      case 'channel':
        if (message.target) sendToChannelLocal(message.target, message.event);
        break;
      case 'broadcast':
        broadcastLocal(message.event);
        break;
    }
    return;
  }

  try {
    const pub = getRedisPub();
    await pub.publish(WS_CHANNEL, JSON.stringify(message));
  } catch (err) {
    log.error('Failed to publish to Redis:', err);
    switch (message.type) {
      case 'user':
        if (message.target) sendToUserLocal(message.target, message.event);
        break;
      case 'channel':
        if (message.target) sendToChannelLocal(message.target, message.event);
        break;
      case 'broadcast':
        broadcastLocal(message.event);
        break;
    }
  }
};

export const sendToUser = (userId: string, event: WSOutbound): void => {
  publish({ type: 'user', target: userId, event });
};

export const sendToChannel = (channel: string, event: WSOutbound): void => {
  publish({ type: 'channel', target: channel, event });
};

export const broadcast = (event: WSOutbound): void => {
  publish({ type: 'broadcast', event });
};

export const isPubSubEnabled = (): boolean => {
  return pubsubEnabled;
};
