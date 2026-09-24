/**
 * @atlas
 * @kind helper
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { WSQueryEvent } from '@template/shared/ws';

export const refetch = (key: WSQueryEvent['key']): WSQueryEvent => ({ category: 'query', action: 'refetch', key });
