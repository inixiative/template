/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { StreamKind, StreamOps, StreamOrdering } from '@template/shared/ws';
import { listStream } from '@template/ui/lib/ws/listStream';
import { logStream } from '@template/ui/lib/ws/logStream';

export type FoldContext = { revive?: true; ordering?: StreamOrdering };

type Fold = (state: unknown, payload: unknown, context: FoldContext) => unknown;

export type StreamFold = { snapshot: (previous: unknown, next: unknown) => unknown; ops: Record<string, Fold> };

const foldsByKind = { list: listStream, log: logStream } satisfies {
  [K in StreamKind]: { ops: { [Op in keyof StreamOps[K]]: unknown } };
};

export const streamFoldFor = (kind: StreamKind): StreamFold => foldsByKind[kind] as unknown as StreamFold;
