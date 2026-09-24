/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses none
 */
import { type RegisteredStream, streamDefinitionFor } from '@template/db/streams';
import { parseChannelKey } from '@template/shared/ws';

export const streamDefinitionOf = (stream: string): RegisteredStream | null =>
  streamDefinitionFor(parseChannelKey(stream)._id);
