/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { ListStreamAppend } from '@template/shared/ws';

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

type ListRow = { id: string; updatedAt?: string };

export type ListStreamSnapshot<T extends ListRow> = { data: T[]; pagination?: Pagination };

const withTotal = (pagination: Pagination | undefined, delta: number): Pagination | undefined => {
  if (!pagination) return pagination;
  const total = Math.max(0, pagination.total + delta);
  return { ...pagination, total, totalPages: Math.ceil(total / pagination.pageSize) };
};

const isPartialPage = (snapshot: ListStreamSnapshot<ListRow>): boolean =>
  (snapshot.pagination?.total ?? snapshot.data.length) > snapshot.data.length;

// Rows are held in the list routes' default `id desc` order (uuidv7 ids, newest first).
const isBeyondLoadedRows = (snapshot: ListStreamSnapshot<ListRow>, id: string): boolean => {
  const oldest = snapshot.data.at(-1);
  return isPartialPage(snapshot) && !!oldest && id < oldest.id;
};

const isStale = (current: ListRow, incoming: ListRow): boolean =>
  !!current.updatedAt && !!incoming.updatedAt && incoming.updatedAt < current.updatedAt;

export const reduceListStream = <T extends ListRow>(
  snapshot: ListStreamSnapshot<T>,
  append: ListStreamAppend<T>,
): ListStreamSnapshot<T> => {
  if ('remove' in append) {
    if (!snapshot.data.some((row) => row.id === append.remove)) return snapshot;
    return {
      ...snapshot,
      data: snapshot.data.filter((row) => row.id !== append.remove),
      pagination: withTotal(snapshot.pagination, -1),
    };
  }
  const row = append.upsert;
  const index = snapshot.data.findIndex((held) => held.id === row.id);
  if (index !== -1) {
    const held = snapshot.data[index] as T;
    if (isStale(held, row)) return snapshot;
    return { ...snapshot, data: snapshot.data.map((current, i) => (i === index ? row : current)) };
  }
  if (isBeyondLoadedRows(snapshot, row.id)) return snapshot;
  const insertAt = snapshot.data.findIndex((held) => held.id < row.id);
  const data = [...snapshot.data];
  data.splice(insertAt === -1 ? data.length : insertAt, 0, row);
  return { ...snapshot, data, pagination: withTotal(snapshot.pagination, 1) };
};
