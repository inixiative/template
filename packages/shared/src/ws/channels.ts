/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import { WSActor } from './actors';
import { channelKey } from './channelKey';

// Everything that can carry a WS channel: its naming, its protocol, and which actor may
// subscribe. Both ends derive channel names from here — the FE to subscribe, the API to publish
// and authorize — so naming can't drift between them. Adding a subscribable thing = an entry here.
//
// `type` is the channel's protocol. 'query' channels are named by channelKey(queryKey) and carry
// refetch hints (WSEvent). A future event-stream protocol would be a new type here, not a new
// naming convention.
export const WS_CHANNELS = {
  // One inquiry's read query: refetch hints on server-side change. id-keyed.
  inquiryRead: {
    type: 'query',
    actor: WSActor.User,
    name: (id: string) => channelKey({ _id: 'inquiryRead', path: { id } }),
  },
} as const;

export type WSChannelFamily = keyof typeof WS_CHANNELS;

// The registry family a channel name belongs to — names are `<family>:...`.
export const channelFamily = (channel: string): WSChannelFamily | undefined => {
  const family = channel.split(':')[0] as WSChannelFamily;
  return WS_CHANNELS[family] ? family : undefined;
};
