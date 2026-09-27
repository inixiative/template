/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { WSStreamSnapshotEvent } from '@template/shared/ws';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import { failDataStream } from '@template/ui/lib/ws/failDataStream';
import { streamDefinitionOf } from '@template/ui/lib/ws/streamDefinitionOf';
import { streamRebaseFor } from '@template/ui/lib/ws/streamReducers';
import { useAppStore } from '@template/ui/store';

export const applyStreamSnapshot = (event: WSStreamSnapshotEvent): void => {
  const definition = streamDefinitionOf(event.stream);
  if (!definition) return;
  const parsed = definition.snapshot.safeParse(event.payload);
  if (!parsed.success) {
    console.error(`ws stream ${event.stream}: snapshot failed validation`, parsed.error);
    failDataStream(event.stream, 'failed');
    return;
  }
  const rebase = streamRebaseFor(event.stream);
  useAppStore
    .getState()
    .client?.setQueryData(dataStreamQueryKey(event.stream), (previous: unknown) =>
      previous === undefined || !rebase ? parsed.data : rebase(previous, parsed.data),
    );
};
