import { describe, expect, it } from 'bun:test';
import { buildContact } from '@template/db/test';
import type { OrganizationReadManyContactsResponse } from '@template/sdk';
import { reduceListStream } from '@template/ui/lib/ws/reduceListStream';

type ContactRow = OrganizationReadManyContactsResponse['data'][number];

const contactRow = async (id: string, updatedAt = '2026-01-01T00:00:00.000Z'): Promise<ContactRow> => {
  const { entity } = await buildContact({
    id,
    ownerModel: 'Organization',
    organizationId: 'org-1',
    updatedAt: new Date(updatedAt),
  });
  return entity.__serialize() as ContactRow;
};

const snapshotOf = (data: ContactRow[], total = data.length, pageSize = 10) => ({
  data,
  pagination: { page: 1, pageSize, total, totalPages: Math.ceil(total / pageSize) },
});

describe('reduceListStream', () => {
  it('inserts a new row in id-desc order and grows the total', async () => {
    const older = await contactRow('0003');
    const oldest = await contactRow('0001');
    const created = await contactRow('0009');
    const between = await contactRow('0002');

    const withCreated = reduceListStream(snapshotOf([older, oldest]), { upsert: created });
    const withBetween = reduceListStream(withCreated, { upsert: between });

    expect(withBetween.data.map((row) => row.id)).toEqual(['0009', '0003', '0002', '0001']);
    expect(withBetween.pagination?.total).toBe(4);
  });

  it('replaces a row it already holds in place, so a repeated append is idempotent', async () => {
    const first = await contactRow('0002');
    const second = await contactRow('0001');
    const updated = await contactRow('0001', '2026-02-01T00:00:00.000Z');

    const once = reduceListStream(snapshotOf([first, second]), { upsert: updated });
    const twice = reduceListStream(once, { upsert: updated });

    expect(twice.data).toEqual([first, updated]);
    expect(twice.pagination?.total).toBe(2);
  });

  it('ignores an upsert older than the row it holds', async () => {
    const current = await contactRow('0001', '2026-02-01T00:00:00.000Z');
    const stale = await contactRow('0001', '2026-01-01T00:00:00.000Z');
    const snapshot = snapshotOf([current]);

    expect(reduceListStream(snapshot, { upsert: stale })).toBe(snapshot);
  });

  it('ignores an upsert for a row beyond the loaded page', async () => {
    const snapshot = snapshotOf([await contactRow('0005'), await contactRow('0004')], 12, 2);

    expect(reduceListStream(snapshot, { upsert: await contactRow('0001') })).toBe(snapshot);
  });

  it('removes a row and shrinks the total', async () => {
    const kept = await contactRow('0002');
    const removed = await contactRow('0001');

    const next = reduceListStream(snapshotOf([kept, removed]), { remove: removed.id });

    expect(next.data).toEqual([kept]);
    expect(next.pagination?.total).toBe(1);
  });

  it('returns the same snapshot when removing a row it does not hold', async () => {
    const snapshot = snapshotOf([await contactRow('0001')]);
    expect(reduceListStream(snapshot, { remove: 'missing' })).toBe(snapshot);
  });
});
