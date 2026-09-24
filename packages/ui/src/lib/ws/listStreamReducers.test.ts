import { describe, expect, it } from 'bun:test';
import { type ListStreamState, listStreamReducers } from '@template/ui/lib/ws/listStreamReducers';

const { upsert, remove } = listStreamReducers;

const at = (day: number) => `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`;
const row = (id: string, day = 1) => ({ id, updatedAt: at(day) });
type Row = { id: string; updatedAt: string };
const page = (data: Row[], total = data.length, pageSize = 10): ListStreamState<Row> => ({
  data,
  pagination: { page: 1, pageSize, total, totalPages: Math.ceil(total / pageSize) },
});
const ids = (state: { data: Array<{ id: string }> }) => state.data.map((held) => held.id);

describe('listStreamReducers', () => {
  it('inserts a new row in id-desc order and grows the total', () => {
    const withCreated = upsert(page([row('0003'), row('0001')]), row('0009'));
    const withBetween = upsert(withCreated, row('0002'));

    expect(ids(withBetween)).toEqual(['0009', '0003', '0002', '0001']);
    expect(withBetween.pagination?.total).toBe(4);
  });

  it('replaces a held row in place, so a repeated upsert is idempotent', () => {
    const updated = row('0001', 2);
    const once = upsert(page([row('0002'), row('0001')]), updated);
    const twice = upsert(once, updated);

    expect(twice.data).toEqual([row('0002'), updated]);
    expect(twice.pagination?.total).toBe(2);
  });

  it('ignores an upsert older than the row it holds', () => {
    const state = page([row('0001', 2)]);
    expect(upsert(state, row('0001', 1))).toBe(state);
  });

  it('ignores an upsert for a row beyond the loaded page', () => {
    const state = page([row('0005'), row('0004')], 12, 2);
    expect(upsert(state, row('0001'))).toBe(state);
  });

  it('removes a held row and shrinks the total', () => {
    const next = remove(page([row('0002'), row('0001')]), { id: '0001', updatedAt: at(2) });

    expect(ids(next)).toEqual(['0002']);
    expect(next.pagination?.total).toBe(1);
  });

  it('does not resurrect a removed row when a late upsert of its older version arrives', () => {
    const removed = remove(page([row('0002', 2), row('0001')]), { id: '0002', updatedAt: at(3) });
    const late = upsert(removed, row('0002', 2));
    const sameVersion = upsert(removed, row('0002', 3));

    expect(ids(late)).toEqual(['0001']);
    expect(ids(sameVersion)).toEqual(['0001']);
    expect(late.pagination?.total).toBe(1);
  });

  it('restores a removed row when a write newer than the removal arrives', () => {
    const removed = remove(page([row('0002', 2), row('0001')]), { id: '0002', updatedAt: at(3) });
    const restored = upsert(removed, row('0002', 4));

    expect(ids(restored)).toEqual(['0002', '0001']);
    expect(restored.__removed?.['0002']).toBeUndefined();
  });

  it('ignores a removal older than the held row', () => {
    const state = page([row('0001', 5)]);
    expect(remove(state, { id: '0001', updatedAt: at(4) })).toBe(state);
  });

  it('counts a removal of an off-page row against the total, once', () => {
    const state = page([row('0009'), row('0008')], 5, 2);
    const once = remove(state, { id: '0001', updatedAt: at(2) });
    const twice = remove(once, { id: '0001', updatedAt: at(2) });

    expect(ids(once)).toEqual(['0009', '0008']);
    expect(once.pagination?.total).toBe(4);
    expect(once.pagination?.totalPages).toBe(2);
    expect(twice).toBe(once);
  });

  it('leaves the total alone for a removal inside the loaded range of a row it never held', () => {
    const state = page([row('0009'), row('0001')], 5, 2);
    expect(remove(state, { id: '0005', updatedAt: at(2) }).pagination?.total).toBe(5);
  });

  it('evicts beyond pageSize so a long-lived stream stays one page', () => {
    let state = page([row('0001')], 1, 2);
    for (const id of ['0002', '0003', '0004', '0005', '0006']) state = upsert(state, row(id));

    expect(ids(state)).toEqual(['0006', '0005']);
    expect(state.pagination?.total).toBe(6);
  });

  it('caps its tombstones', () => {
    let state = page([row('9999')], 1, 10);
    for (let i = 0; i < 600; i++) state = remove(state, { id: `gone-${i}`, updatedAt: at(2) });

    expect(Object.keys(state.__removed ?? {})).toHaveLength(500);
    expect(state.__removed?.['gone-599']).toBe(at(2));
    expect(state.__removed?.['gone-0']).toBeUndefined();
  });
});
