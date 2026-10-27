/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses none
 */
import { channelKey, parseChannelKey, WS_CHANNELS } from '@template/shared/ws';

const channels: Record<string, { name: unknown; me?: boolean }> = WS_CHANNELS;

export const isMeChannel = (channel: string): boolean => {
  const { _id } = parseChannelKey(channel);
  return Object.hasOwn(channels, _id) && channels[_id]?.me === true;
};

export const meChannel = (channel: string, userId: string): string =>
  channelKey({ ...parseChannelKey(channel), path: { userId } });
