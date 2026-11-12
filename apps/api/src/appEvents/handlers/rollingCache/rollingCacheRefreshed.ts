/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:caching, primitive:websockets
 */
import { parseChannelKey } from '@template/shared/ws';
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type RollingCacheRefreshedPayload = {
  rollingCache: string;
  key: string;
  channel?: string;
};

// Raised by a rolling-cache leaf (refreshRollingCacheTarget) whose refresh landed. When the cache
// declared a channel, its subscribers get a `query`/`refetch` hint keyed by the channel parsed back
// into its query key, so the client refetches the read the channel stands for. The event carries no
// value: a websocket event is a hint, the read is the truth.
export const rollingCacheRefreshed = makeAppEvent<RollingCacheRefreshedPayload>({
  websocket: ({ channel }) => {
    if (!channel) return [];
    return [
      {
        kind: 'channels',
        target: { channels: [channel] },
        message: { data: { category: 'query', action: 'refetch', key: parseChannelKey(channel) } },
      },
    ];
  },
});
