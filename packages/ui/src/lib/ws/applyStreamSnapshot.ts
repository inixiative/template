/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import { streamDefinitionOf, type WSStreamSnapshotEvent } from '@template/shared/ws';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import type { MessageContext } from '@template/ui/lib/ws/messageContext';
import { streamFoldFor } from '@template/ui/lib/ws/streamFolds';

export const applyStreamSnapshot = (
  event: WSStreamSnapshotEvent,
  { client }: MessageContext,
): void => {
  const definition = streamDefinitionOf(event.stream);
  if (!definition) return;
  const fold = streamFoldFor(definition.kind).snapshot;
  client?.setQueryData(dataStreamQueryKey(event.stream), (previous: unknown) =>
    fold(previous, event.payload),
  );
};
