import { describe, expect, it } from 'bun:test';
import { type ListStreamState, listStream } from '@template/ui/lib/ws/listStream';

const { upsert, remove } = listStream.ops;

type Row = { id: string; name?: string; updatedAt?: string };
const row = (id: string, name?: string): Row => ({ id, ...(name ? { name } : {}) });
const page = (data: Row[], total = data.length, pageSize = 10): ListStreamState<Row> => ({
  data,
  pagination: { page: 1, pageSize, total, totalPages: Math.ceil(total / pageSize) },
});
const ids = (state: { data: Array<{ id: string }> }) => state.data.map((held) => held.id);

describe('listStream', () => {
  it('inserts a new row in id-desc order and grows the total', () => {
    const withCreated = upsert(page([row('0003'), row('0001')]), row('0009'));
    const withBetween = upsert(withCreated, row('0002'));

    expect(ids(withBetween)).toEqual(['0009', '0003', '0002', '0001']);
    expect(withBetween.pagination?.total).toBe(4);
  });

  it('replaces a held row in place, so a repeated upsert is idempotent', () => {
    const updated = row('0001', 'b');
    const once = upsert(page([row('0002'), row('0001', 'a')]), updated);
    const twice = upsert(once, updated);

    expect(twice.data).toEqual([row('0002'), updated]);
    expect(twice.pagination?.total).toBe(2);
  });

  it('by updatedAt, ignores an update older than the held row and applies an equal or newer one', () => {
    const version = (day: number, name?: string): Row => ({
      ...row('0001', name),
      updatedAt: `2026-01-0${day}T00:00:00.000Z`,
    });
    const state = page([version(2)]);
    const byUpdatedAt = { ordering: 'updatedAt' } as const;

    expect(upsert(state, version(1), byUpdatedAt)).toBe(state);
    expect(upsert(state, version(2, 'same'), byUpdatedAt).data).toEqual([version(2, 'same')]);
    expect(upsert(state, version(3), byUpdatedAt).data).toEqual([version(3)]);
  });

  it('by arrival, lets the last update to arrive win', () => {
    const newer: Row = { id: '0001', updatedAt: '2026-01-02T00:00:00.000Z' };
    const older: Row = { id: '0001', updatedAt: '2026-01-01T00:00:00.000Z' };

    expect(upsert(page([newer]), older, { ordering: 'arrival' }).data).toEqual([older]);
  });

  it('ignores an upsert for a row beyond the loaded page', () => {
    const state = page([row('0005'), row('0004')], 12, 2);
    expect(upsert(state, row('0001'))).toBe(state);
  });

  it('removes a held row and shrinks the total', () => {
    const next = remove(page([row('0002'), row('0001')]), { id: '0001' });

    expect(ids(next)).toEqual(['0002']);
    expect(next.pagination?.total).toBe(1);
  });

  it('treats a removal as final: a late upsert never brings the row back', () => {
    const removed = remove(page([row('0002'), row('0001')]), { id: '0002' });
    const late = upsert(removed, row('0002', 'late'));

    expect(late).toBe(removed);
    expect(ids(late)).toEqual(['0001']);
  });

  it('brings a removed row back only on an upsert flagged revive', () => {
    const removed = remove(page([row('0002'), row('0001')]), { id: '0002' });
    const revived = upsert(removed, row('0002'), { revive: true });

    expect(ids(revived)).toEqual(['0002', '0001']);
    expect(revived.pagination?.total).toBe(2);
    expect(ids(upsert(revived, row('0002', 'later')))).toEqual(['0002', '0001']);
  });

  it('restores the total when a revive brings back a row beyond the loaded page', () => {
    const state = page([row('0009'), row('0008')], 5, 2);
    const removed = remove(state, { id: '0001' });
    const revived = upsert(removed, row('0001'), { revive: true });
    const again = upsert(revived, row('0001'), { revive: true });

    expect(removed.pagination?.total).toBe(4);
    expect(revived.pagination?.total).toBe(5);
    expect(revived.__removed ?? []).not.toContain('0001');
    expect(again).toBe(revived);
  });

  it('counts a removal of an off-page row against the total, once', () => {
    const state = page([row('0009'), row('0008')], 5, 2);
    const once = remove(state, { id: '0001' });
    const twice = remove(once, { id: '0001' });

    expect(ids(once)).toEqual(['0009', '0008']);
    expect(once.pagination?.total).toBe(4);
    expect(once.pagination?.totalPages).toBe(2);
    expect(twice).toBe(once);
  });

  it('leaves the total alone for a removal inside the loaded range of a row it never held', () => {
    const state = page([row('0009'), row('0001')], 5, 2);
    expect(remove(state, { id: '0005' }).pagination?.total).toBe(5);
  });

  it('evicts beyond pageSize so a long-lived stream stays one page', () => {
    let state = page([row('0001')], 1, 2);
    for (const id of ['0002', '0003', '0004', '0005', '0006']) state = upsert(state, row(id));

    expect(ids(state)).toEqual(['0006', '0005']);
    expect(state.pagination?.total).toBe(6);
  });

  it('caps its tombstones', () => {
    let state = page([row('9999')], 1, 10);
    for (let i = 0; i < 600; i++) state = remove(state, { id: `gone-${i}` });

    expect(state.__removed).toHaveLength(500);
    expect(state.__removed).toContain('gone-599');
    expect(state.__removed).not.toContain('gone-0');
  });

  it('keeps tombstones across a fresh snapshot, except for rows the snapshot shows alive', () => {
    const removed = remove(remove(page([row('0003'), row('0002'), row('0001')]), { id: '0003' }), { id: '0002' });
    const next = listStream.snapshot(removed, page([row('0002'), row('0001')]));

    expect(next.__removed).toEqual(['0003']);
    expect(ids(upsert(next, row('0003')))).toEqual(['0002', '0001']);
    expect(ids(upsert(next, row('0002', 'edit')))).toEqual(['0002', '0001']);
  });
});
