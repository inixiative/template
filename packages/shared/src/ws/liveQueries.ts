/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import { WS_CHANNELS } from '@template/shared/ws/channels';

export const LIVE_QUERIES = new Set<string>(Object.keys(WS_CHANNELS));
