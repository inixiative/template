/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses infrastructure:redis
 */
import { getRedisPub, getRedisSub } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { type StreamAppend, streamAppendFrame } from '#/ws/dataFrame';
import {
  broadcastLocal,
  sendToChannelLocal,
  sendToStreamLocal,
  sendToUserLocal,
} from '#/ws/delivery';
import { publishStreamAppend } from '#/ws/queries/publishStreamAppend';
import { byId, byStream } from '#/ws/registry';
import { rejectDataStream } from '#/ws/rejectDataStream';
import { inStreamOrder } from '#/ws/streamPublishOrder';
import type { WSOutbound } from '#/ws/types';

const WS_CHANNEL = 'ws:broadcast';

type PubSubMessage =
  | { type: 'user' | 'channel'; target: string; event: WSOutbound }
  | { type: 'broadcast'; event: WSOutbound }
  | { type: 'stream'; target: string; userIds?: string[]; seq: number; append: StreamAppend };

let initialized = false;
let pubsubEnabled = false;

const deliverLocal = (message: PubSubMessage): void => {
  switch (message.type) {
    case 'user':
      sendToUserLocal(message.target, message.event);
      break;
    case 'channel':
      sendToChannelLocal(message.target, message.event);
      break;
    case 'stream':
      sendToStreamLocal(
        message.target,
        streamAppendFrame(message.target, message.seq, message.append),
        message.userIds,
      );
      break;
    case 'broadcast':
      broadcastLocal(message.event);
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

const publish = async (message: Exclude<PubSubMessage, { type: 'stream' }>): Promise<void> => {
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

// An unsequenced append would drift its holders, so they re-open for a snapshot instead.
const resyncLocalHolders = (stream: string): void => {
  for (const id of [...(byStream.get(stream) ?? [])]) {
    const ws = byId.get(id);
    if (!ws) continue;
    void ws.data.queue.run(async () => {
      if (byId.has(id) && ws.data.streams.has(stream)) rejectDataStream(ws, stream, 'retryable');
    });
  }
};

// Serialized per stream so this instance publishes a stream's appends in emission order.
export const appendToStream = (
  stream: string,
  append: StreamAppend,
  userIds?: string[],
): Promise<void> =>
  inStreamOrder(stream, async () => {
    try {
      await publishStreamAppend(getRedisPub(), WS_CHANNEL, stream, {
        type: 'stream',
        target: stream,
        ...(userIds ? { userIds } : {}),
        append,
      });
    } catch (err) {
      log.error(`Failed to publish a stream append (${stream}); resyncing local holders:`, err);
      resyncLocalHolders(stream);
    }
  });

export const broadcast = (event: WSOutbound): Promise<void> =>
  publish({ type: 'broadcast', event });

export const isPubSubEnabled = (): boolean => {
  return pubsubEnabled;
};
