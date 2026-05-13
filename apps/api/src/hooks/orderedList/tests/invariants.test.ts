import { describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { createUser } from '@template/db/test';
import { reorderInList } from '#/lib/prisma/orderedList';
import { liveOrders, phone, phoneRow, posOf, positions, restore, scope, softDelete } from './setup';

describe('unique constraint safety', () => {
  it('insert-at shifts before write (no collision)', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    await phone(u.id);
    await phone(u.id);
    expect((await phone(u.id, 2)).position).toBe(2);
  });

  it('createMany at overlapping positions (no collision)', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    await phone(u.id);
    await db.contact.createManyAndReturn({
      data: [phoneRow(u.id, 1), phoneRow(u.id, 1)],
    });
    expect(positions(await liveOrders(u.id))).toEqual([1, 2, 3, 4]);
  });

  it('reorder parks at 0 first (no collision)', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    await phone(u.id);
    const c = await phone(u.id);
    await reorderInList('Contact', scope(u.id), c.id, 3, 1);
    expect(positions(await liveOrders(u.id))).toEqual([1, 2, 3]);
  });

  it('direct position update reorders (no collision)', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    const b = await phone(u.id);
    await phone(u.id);
    await db.contact.update({ where: { id: b.id }, data: { position: 1 } });
    expect(positions(await liveOrders(u.id))).toEqual([1, 2, 3]);
  });

  it('soft-delete + create at same position (no collision)', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    await softDelete(a.id);
    const c = await phone(u.id, 1);
    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2]);
    expect(posOf(rows, c.id)).toBe(1);
    expect(posOf(rows, b.id)).toBe(2);
  });
});

describe('density invariant', () => {
  it('mixed create/delete/insert/restore stays [1..N]', async () => {
    const { entity: u } = await createUser();
    const items = [];
    for (let i = 0; i < 5; i++) items.push(await phone(u.id)); // [1..5]

    await softDelete(items[2]!.id); // live: [1,2,3,4]
    await phone(u.id, 2); // live: [1,2,3,4,5]
    await restore(items[2]!.id); // live: [1,2,3,4,5,6]

    expect(positions(await liveOrders(u.id))).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
