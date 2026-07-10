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
export type WSEvent = { category: 'query'; action: 'refetch'; key: ChannelKeyInput };
