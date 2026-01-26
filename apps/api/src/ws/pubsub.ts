import { log } from '#/lib/logger';
/**
 * WebSocket Pub/Sub Layer
 *
 * Enables cross-server WebSocket broadcasting via Redis.
 * When Redis is available, messages are published to Redis channels
 * and all servers subscribe to receive and forward to their local connections.
 *
 * Falls back to local-only when Redis is unavailable (dev mode).
 */

import { getRedisPub, getRedisSub } from '#/lib/clients/redis';
import { broadcastLocal, sendToChannelLocal, sendToUserLocal } from '#/ws/connections';
import type { AppEventPayload } from '#/ws/types';

const WS_CHANNEL = 'ws:broadcast';

type PubSubMessage = {
  type: 'user' | 'channel' | 'broadcast';
  target?: string; // userId or channel name
  event: AppEventPayload;
};

let initialized = false;
let pubsubEnabled = false;

/**
 * Initialize Redis pub/sub for WebSocket broadcasting.
 * Call this once at server startup.
 */
export async function initWebSocketPubSub(): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    const sub = getRedisSub();

    // Subscribe to WebSocket broadcast channel
    await sub.subscribe(WS_CHANNEL);

    sub.on('message', (channel, message) => {
      if (channel !== WS_CHANNEL) return;

      try {
        const { type, target, event } = JSON.parse(message) as PubSubMessage;

        // Forward to local connections
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
    log.info('✅ WebSocket pub/sub enabled (Redis)');
  } catch (err) {
    log.warn('⚠️ WebSocket pub/sub disabled (Redis unavailable):', err);
    pubsubEnabled = false;
  }
}

/**
 * Publish a message to all servers via Redis.
 */
async function publish(message: PubSubMessage): Promise<void> {
  if (!pubsubEnabled) {
    // Fallback to local-only
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
    // Fallback to local
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
}

/**
 * Send an event to a specific user across all servers.
 */
export function sendToUser(userId: string, event: AppEventPayload): void {
  publish({ type: 'user', target: userId, event });
}

/**
 * Send an event to all subscribers of a channel across all servers.
 */
export function sendToChannel(channel: string, event: AppEventPayload): void {
  publish({ type: 'channel', target: channel, event });
}

/**
 * Broadcast an event to all connected users across all servers.
 */
export function broadcast(event: AppEventPayload): void {
  publish({ type: 'broadcast', event });
}

/**
 * Check if pub/sub is enabled (Redis connected).
 */
export function isPubSubEnabled(): boolean {
  return pubsubEnabled;
}
