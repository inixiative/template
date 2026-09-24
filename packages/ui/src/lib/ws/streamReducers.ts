/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui, primitive:websockets
 * @uses none
 */
type ActionReducer = (state: unknown, payload: unknown) => unknown;

export type RegisteredReducers = Record<string, ActionReducer>;

export type SnapshotRebase = (previous: unknown, snapshot: unknown) => unknown;

type Folding = { reducers: RegisteredReducers; rebase?: SnapshotRebase };

const foldingByStream = new Map<string, Folding[]>();

// The first holder to mount folds the shared snapshot; later holders' reducers wait their turn.
export const registerStreamReducers = (
  stream: string,
  reducers: RegisteredReducers,
  rebase?: SnapshotRebase,
): (() => void) => {
  const folding: Folding = { reducers, rebase };
  foldingByStream.set(stream, [...(foldingByStream.get(stream) ?? []), folding]);
  return () => {
    const remaining = (foldingByStream.get(stream) ?? []).filter((held) => held !== folding);
    if (remaining.length) foldingByStream.set(stream, remaining);
    else foldingByStream.delete(stream);
  };
};

export const streamReducerFor = (stream: string, type: string): ActionReducer | null =>
  foldingByStream.get(stream)?.[0]?.reducers[type] ?? null;

export const streamRebaseFor = (stream: string): SnapshotRebase | null =>
  foldingByStream.get(stream)?.[0]?.rebase ?? null;
