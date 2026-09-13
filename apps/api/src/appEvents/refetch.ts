/**
 * @atlas
 * @kind helper
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { WSEvent } from '@template/shared/ws';

export const refetch = (key: WSEvent['key']): WSEvent => ({ category: 'query', action: 'refetch', key });
