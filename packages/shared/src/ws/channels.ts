/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import { channelKey } from './channelKey';

// Everything that can carry a WS channel. 'query' channels are live queries: keyed by the query's
// operationId, named by channelKey(queryKey), and authorized by their own route — the subscribe
// handler probes the operation's endpoint with the connection's credential, so a channel's access
// rules are exactly its route's and there is no second auth surface to maintain. A future
// event-stream protocol would be a new `type` here, not a new naming convention.
export const WS_CHANNELS = {
  // One inquiry's read query: refetch hints on server-side change. id-keyed.
  inquiryRead: {
    type: 'query',
    name: (id: string) => channelKey({ _id: 'inquiryRead', path: { id } }),
  },
} as const;

export type WSChannelFamily = keyof typeof WS_CHANNELS;
