/**
 * @atlas
 * @kind type
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import type { ChannelKeyInput } from '@template/shared/ws/channelKey';

// Server → client WS events: flat, discriminated by category + action. `key` is the query the
// event concerns — channelKey(key) routes it, and the FE acts on it per action. Both ends type
// against this one contract; the FE dispatch map mirrors it as handlers[category][action].
//
// Delivery contract: a WS event is a HINT, never the source of truth. Nothing is persisted or
// replayed — anything emitted while a client is disconnected is dropped. Every consumer must own
// a recovery path that doesn't depend on the push (query channels: refetch-on-reconnect).
export type WSEvent = { category: 'query'; action: 'refetch'; key: ChannelKeyInput };
