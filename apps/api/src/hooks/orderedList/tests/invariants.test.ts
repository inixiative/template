import { describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { createUser } from '@template/db/test';
import {
  createPhoneContact,
  fetchNotDeletedContactPositions,
  phoneContactData,
  positionOfContact,
  positions,
  restoreContact,
  softDeleteContact,
} from '#/hooks/orderedList/tests/setup';

describe('unique constraint safety', () => {
  it('insert-at shifts before write (no collision)', async () => {
    const { entity: u } = await createUser();
    await createPhoneContact(u.id);
    await createPhoneContact(u.id);
    await createPhoneContact(u.id);
    expect((await createPhoneContact(u.id, 2)).position).toBe(2);
  });

  it('createMany at overlapping positions (no collision)', async () => {
    const { entity: u } = await createUser();
    await createPhoneContact(u.id);
    await createPhoneContact(u.id);
    await db.contact.createManyAndReturn({
      data: [phoneContactData(u.id, 1), phoneContactData(u.id, 1)],
    });
    expect(positions(await fetchNotDeletedContactPositions(u.id))).toEqual([1, 2, 3, 4]);
  });

  it('direct position update reorders (no collision)', async () => {
    const { entity: u } = await createUser();
    await createPhoneContact(u.id);
    const b = await createPhoneContact(u.id);
    await createPhoneContact(u.id);
    await db.contact.update({ where: { id: b.id }, data: { position: 1 } });
    expect(positions(await fetchNotDeletedContactPositions(u.id))).toEqual([1, 2, 3]);
  });

  it('soft-delete + create at same position (no collision)', async () => {
    const { entity: u } = await createUser();
    const a = await createPhoneContact(u.id);
    const b = await createPhoneContact(u.id);
    await softDeleteContact(a.id);
    const c = await createPhoneContact(u.id, 1);
    const rows = await fetchNotDeletedContactPositions(u.id);
    expect(positions(rows)).toEqual([1, 2]);
    expect(positionOfContact(rows, c.id)).toBe(1);
    expect(positionOfContact(rows, b.id)).toBe(2);
  });
});

describe('density invariant', () => {
  it('mixed create/delete/insert/restore stays [1..N]', async () => {
    const { entity: u } = await createUser();
    const items = [];
    for (let i = 0; i < 5; i++) items.push(await createPhoneContact(u.id)); // [1..5]

    await softDeleteContact(items[2]!.id); // not-deleted: [1,2,3,4]
    await createPhoneContact(u.id, 2); // not-deleted: [1,2,3,4,5]
    await restoreContact(items[2]!.id); // not-deleted: [1,2,3,4,5,6]

    expect(positions(await fetchNotDeletedContactPositions(u.id))).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
