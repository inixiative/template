/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import { parseChannelKey, type WSStreamFamily } from '@template/shared/ws';
import { reduceListStream } from '@template/ui/lib/ws/reduceListStream';

export type DataStreamReducer = (snapshot: never, append: never) => unknown;

// Appends can repeat what the snapshot already holds, so every reducer must be idempotent.
export const DATA_STREAM_REDUCERS: Record<WSStreamFamily, DataStreamReducer> = {
  organizationReadManyContacts: reduceListStream,
};

export const dataStreamReducer = (stream: string): ((snapshot: unknown, append: unknown) => unknown) | null =>
  (DATA_STREAM_REDUCERS[parseChannelKey(stream)._id as WSStreamFamily] as
    | ((snapshot: unknown, append: unknown) => unknown)
    | undefined) ?? null;
