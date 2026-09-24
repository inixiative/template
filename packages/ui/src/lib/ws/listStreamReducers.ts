/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { ListStreamPagination, ListStreamRemoval, ListStreamRow } from '@template/shared/ws';
import { omit } from 'lodash-es';

const MAX_TOMBSTONES = 500;

export type ListStreamState<R extends ListStreamRow> = {
  data: R[];
  pagination?: ListStreamPagination;
  __removed?: Record<string, string>;
};

const version = (updatedAt: string): number => Date.parse(updatedAt);

const withTotal = (pagination: ListStreamPagination | undefined, delta: number): ListStreamPagination | undefined => {
  if (!pagination) return pagination;
  const total = Math.max(0, pagination.total + delta);
  return { ...pagination, total, totalPages: Math.ceil(total / pagination.pageSize) };
};

const isPartialPage = (state: ListStreamState<ListStreamRow>): boolean =>
  (state.pagination?.total ?? state.data.length) > state.data.length;

const isBeyondLoadedRows = (state: ListStreamState<ListStreamRow>, id: string): boolean => {
  const oldest = state.data.at(-1);
  return isPartialPage(state) && !!oldest && id < oldest.id;
};

const trimToPage = <R extends ListStreamRow>(data: R[], pagination: ListStreamPagination | undefined): R[] =>
  pagination && data.length > pagination.pageSize ? data.slice(0, pagination.pageSize) : data;

const withTombstone = (removed: Record<string, string> | undefined, removal: ListStreamRemoval) => {
  const next = { ...removed, [removal.id]: removal.updatedAt };
  const ids = Object.keys(next);
  return ids.length > MAX_TOMBSTONES ? omit(next, ids.slice(0, ids.length - MAX_TOMBSTONES)) : next;
};

const upsert = <S extends ListStreamState<R>, R extends ListStreamRow>(state: S, row: R): S => {
  const removedAt = state.__removed?.[row.id];
  if (removedAt !== undefined && version(row.updatedAt) <= version(removedAt)) return state;
  const __removed = removedAt === undefined ? state.__removed : omit(state.__removed, row.id);

  const index = state.data.findIndex((held) => held.id === row.id);
  if (index !== -1) {
    if (version(row.updatedAt) < version((state.data[index] as R).updatedAt)) return state;
    return { ...state, __removed, data: state.data.map((held, i) => (i === index ? row : held)) };
  }
  if (isBeyondLoadedRows(state, row.id)) return __removed === state.__removed ? state : { ...state, __removed };

  const insertAt = state.data.findIndex((held) => held.id < row.id);
  const data = [...state.data];
  data.splice(insertAt === -1 ? data.length : insertAt, 0, row);
  return { ...state, __removed, data: trimToPage(data, state.pagination), pagination: withTotal(state.pagination, 1) };
};

const remove = <S extends ListStreamState<ListStreamRow>>(state: S, removal: ListStreamRemoval): S => {
  const removedAt = state.__removed?.[removal.id];
  if (removedAt !== undefined && version(removal.updatedAt) <= version(removedAt)) return state;
  const held = state.data.find((row) => row.id === removal.id);
  if (held && version(held.updatedAt) > version(removal.updatedAt)) return state;

  const __removed = withTombstone(state.__removed, removal);
  if (held) {
    return {
      ...state,
      __removed,
      data: state.data.filter((row) => row.id !== removal.id),
      pagination: withTotal(state.pagination, -1),
    };
  }
  if (removedAt === undefined && isBeyondLoadedRows(state, removal.id)) {
    return { ...state, __removed, pagination: withTotal(state.pagination, -1) };
  }
  return { ...state, __removed };
};

export const listStreamReducers = { upsert, remove };

// Keeps the reorder guard across a fresh snapshot; a tombstone yields only to a newer copy of its row.
export const listStreamRebase = <S extends ListStreamState<ListStreamRow>>(previous: S, snapshot: S): S => {
  const newer = new Set(
    snapshot.data
      .filter((row) => {
        const removedAt = previous.__removed?.[row.id];
        return removedAt !== undefined && version(row.updatedAt) > version(removedAt);
      })
      .map((row) => row.id),
  );
  const __removed = omit(previous.__removed, [...newer]);
  return Object.keys(__removed).length ? { ...snapshot, __removed } : snapshot;
};
