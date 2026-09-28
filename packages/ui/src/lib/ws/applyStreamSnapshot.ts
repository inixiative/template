/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import { streamDefinitionOf, type WSStreamSnapshotEvent } from '@template/shared/ws';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import { streamFoldFor } from '@template/ui/lib/ws/streamFolds';
import { useAppStore } from '@template/ui/store';

export const applyStreamSnapshot = (event: WSStreamSnapshotEvent): void => {
  const definition = streamDefinitionOf(event.stream);
  if (!definition) return;
  const fold = streamFoldFor(definition.kind).snapshot;
  useAppStore
    .getState()
    .client?.setQueryData(dataStreamQueryKey(event.stream), (previous: unknown) => fold(previous, event.payload));
};
