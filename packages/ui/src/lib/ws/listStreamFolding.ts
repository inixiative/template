/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses none
 */
import { listStreamRebase, listStreamReducers } from '@template/ui/lib/ws/listStreamReducers';

export const listStreamFolding = { reduce: listStreamReducers, rebase: listStreamRebase };
