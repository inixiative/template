/**
 * @atlas
 * @kind utils
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

export const wireChannelOf = (channel: string): string => {
  const { _id, path } = parseChannelKey(channel);
  if (!Object.hasOwn(channels, _id) || channels[_id]?.me !== true) return channel;
  if (!path || !Object.hasOwn(path, 'userId')) return channel;
  const { userId: _userId, ...rest } = path;
  return channelKey({ _id, path: Object.keys(rest).length ? rest : undefined });
};
