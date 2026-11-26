/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses feature:auth
 */
import { retryableErrorFrame } from '@template/shared/ws';
import { sendTo } from '#/ws/delivery';
import { wireChannelOf } from '#/ws/meChannel';
import { reprobeChannelAccess } from '#/ws/probe';
import { connectionsById } from '#/ws/registry';
import { rejectDataStream } from '#/ws/rejectDataStream';
import type { RouteAccess } from '#/ws/routeAccess';
import { reprobeStreamAccess } from '#/ws/streamProbe';
import { unsubscribeFromChannel } from '#/ws/subscriptions';
import type { WSSocket } from '#/ws/types';

const reprobeOrRetryable = (probe: Promise<RouteAccess>): Promise<RouteAccess> =>
  probe.catch((): RouteAccess => 'retryable');

const rejectChannel = (
  ws: WSSocket,
  indexedChannel: string,
  wireChannel: string,
  access: Exclude<RouteAccess, 'granted'>,
): void => {
  unsubscribeFromChannel(ws, indexedChannel);
  sendTo(
    ws,
    access === 'rejected'
      ? { type: 'subscribeRejected', channel: wireChannel }
      : retryableErrorFrame({ action: 'subscribe', channel: wireChannel }),
  );
};

export const reauthorizeStreams = async (ws: WSSocket): Promise<void> => {
  for (const stream of [...ws.data.streams]) {
    const access = await reprobeOrRetryable(reprobeStreamAccess(ws.data.headers, stream));
    if (!connectionsById.has(ws.data.connectionId)) return;
    if (access !== 'granted' && ws.data.streams.has(stream)) rejectDataStream(ws, stream, access);
  }
  for (const channel of [...ws.data.channels]) {
    const wireChannel = wireChannelOf(channel);
    const access = await reprobeOrRetryable(reprobeChannelAccess(ws.data.headers, wireChannel));
    if (!connectionsById.has(ws.data.connectionId)) return;
    if (access !== 'granted' && ws.data.channels.has(channel))
      rejectChannel(ws, channel, wireChannel, access);
  }
};
