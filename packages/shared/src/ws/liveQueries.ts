/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import { WS_CHANNELS, type WSChannelFamily } from './channels';

// Operation ids (queryKey[0]._id) with a realtime producer — the 'query' entries of the channel
// registry, so there is one source of truth for what's subscribable. The FE pipes every query
// through addLiveQuery, which early-returns unless its _id is in here.
export const LIVE_QUERIES = new Set<string>(
  (Object.keys(WS_CHANNELS) as WSChannelFamily[]).filter((family) => WS_CHANNELS[family].type === 'query'),
);
