/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { PaginateResponse } from '@template/sdk';
import type { StreamRow } from '@template/shared/ws';
import type { AppendFlags } from '@template/ui/lib/ws/streamFolds';

const MAX_TOMBSTONES = 500;

export type ListStreamState<R extends StreamRow = StreamRow> = {
  data: R[];
  pagination?: PaginateResponse;
  __removed?: string[];
};

const withTotal = (pagination: PaginateResponse | undefined, delta: number): PaginateResponse | undefined => {
  if (pagination?.total === undefined) return pagination;
  const total = Math.max(0, pagination.total + delta);
  return { ...pagination, total, totalPages: pagination.pageSize ? Math.ceil(total / pagination.pageSize) : undefined };
};

const isBeyondLoadedRows = (state: ListStreamState, id: string): boolean => {
  const oldest = state.data.at(-1);
  return (state.pagination?.total ?? state.data.length) > state.data.length && !!oldest && id < oldest.id;
};

const trimToPage = <R extends StreamRow>(data: R[], pageSize: number | undefined): R[] =>
  pageSize && data.length > pageSize ? data.slice(0, pageSize) : data;

const upsert = <S extends ListStreamState<R>, R extends StreamRow>(state: S, row: R, flags: AppendFlags = {}): S => {
  if (state.__removed?.includes(row.id)) {
    if (!flags.revive) return state;
    return upsert({ ...state, __removed: state.__removed.filter((id) => id !== row.id) }, row);
  }
  const index = state.data.findIndex((held) => held.id === row.id);
  if (index !== -1) return { ...state, data: state.data.map((held, i) => (i === index ? row : held)) };
  if (isBeyondLoadedRows(state, row.id)) return state;

  const insertAt = state.data.findIndex((held) => held.id < row.id);
  const data = [...state.data];
  data.splice(insertAt === -1 ? data.length : insertAt, 0, row);
  return {
    ...state,
    data: trimToPage(data, state.pagination?.pageSize),
    pagination: withTotal(state.pagination, 1),
  };
};

const remove = <S extends ListStreamState>(state: S, { id }: StreamRow): S => {
  if (state.__removed?.includes(id)) return state;
  const __removed = [...(state.__removed ?? []), id].slice(-MAX_TOMBSTONES);
  const held = state.data.some((row) => row.id === id);
  if (!held && !isBeyondLoadedRows(state, id)) return { ...state, __removed };
  return {
    ...state,
    __removed,
    data: held ? state.data.filter((row) => row.id !== id) : state.data,
    pagination: withTotal(state.pagination, -1),
  };
};

const snapshot = <S extends ListStreamState>(previous: S | undefined, next: S): S => {
  const present = new Set(next.data.map((row) => row.id));
  const __removed = previous?.__removed?.filter((id) => !present.has(id));
  return __removed?.length ? { ...next, __removed } : next;
};

export const listStream = { snapshot, ops: { upsert, remove } };
