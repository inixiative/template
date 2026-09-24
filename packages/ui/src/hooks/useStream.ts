/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import { skipToken, type UseQueryResult } from '@tanstack/react-query';
import type {
  StreamActionPayload,
  StreamActionType,
  StreamDefinition,
  StreamParams,
  StreamSnapshot,
} from '@template/shared/ws';
import { useQuery } from '@template/ui/hooks/useQuery';
import { dataStreamQueryKey } from '@template/ui/lib/ws/dataStreamQueryKey';
import {
  type RegisteredReducers,
  registerStreamReducers,
  type SnapshotRebase,
} from '@template/ui/lib/ws/streamReducers';
import { useEffect, useRef } from 'react';

export type StreamReducers<D extends StreamDefinition> = {
  [K in StreamActionType<D>]: (state: StreamSnapshot<D>, payload: StreamActionPayload<D, K>) => StreamSnapshot<D>;
};

export type StreamFolding<D extends StreamDefinition> = {
  reduce: StreamReducers<D>;
  rebase?: (previous: StreamSnapshot<D>, snapshot: StreamSnapshot<D>) => StreamSnapshot<D>;
};

export const useStream = <D extends StreamDefinition>(
  definition: D,
  params: StreamParams<D>,
  folding: StreamFolding<D>,
): UseQueryResult<StreamSnapshot<D>, Error> => {
  const stream = definition.name(params);
  const foldingRef = useRef(folding);
  foldingRef.current = folding;

  useEffect(() => {
    const current = () => foldingRef.current.reduce as unknown as RegisteredReducers;
    const reducers: RegisteredReducers = Object.fromEntries(
      Object.keys(definition.actions).map((type) => [
        type,
        (state: unknown, payload: unknown) => current()[type]?.(state, payload) ?? state,
      ]),
    );
    const rebase: SnapshotRebase = (previous, snapshot) =>
      foldingRef.current.rebase
        ? foldingRef.current.rebase(previous as StreamSnapshot<D>, snapshot as StreamSnapshot<D>)
        : snapshot;
    return registerStreamReducers(stream, reducers, rebase);
  }, [definition, stream]);

  return useQuery<StreamSnapshot<D>, Error, StreamSnapshot<D>, readonly unknown[]>({
    queryKey: dataStreamQueryKey(stream),
    queryFn: skipToken,
    staleTime: Number.POSITIVE_INFINITY,
  });
};
