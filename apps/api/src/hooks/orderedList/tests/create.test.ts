import { describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { createUser, nextFactorySequenceNumber } from '@template/db/test';
import {
  createEmailContact,
  createPhoneContact,
  fetchNotDeletedContactPositions,
  phoneContactData,
  positionOfContact,
  positions,
} from '#/hooks/orderedList/tests/setup';

describe('create', () => {
  it('appends to end when position omitted', async () => {
    const { entity: u } = await createUser();
    const a = await createPhoneContact(u.id);
    const b = await createPhoneContact(u.id);
    const c = await createPhoneContact(u.id);
    expect([a.position, b.position, c.position]).toEqual([1, 2, 3]);
  });

  it('inserts at position and shifts siblings', async () => {
    const { entity: u } = await createUser();
    const a = await createPhoneContact(u.id); // 1
    const b = await createPhoneContact(u.id); // 2
    const c = await createPhoneContact(u.id); // 3
    const d = await createPhoneContact(u.id, 2); // insert at 2

    expect(d.position).toBe(2);
    const rows = await fetchNotDeletedContactPositions(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4]);
    expect(positionOfContact(rows, a.id)).toBe(1);
    expect(positionOfContact(rows, d.id)).toBe(2);
    expect(positionOfContact(rows, b.id)).toBe(3);
    expect(positionOfContact(rows, c.id)).toBe(4);
  });

  it('clamps position to [1, MAX+1]', async () => {
    const { entity: u } = await createUser();
    await createPhoneContact(u.id);
    await createPhoneContact(u.id);
    expect((await createPhoneContact(u.id, 999)).position).toBe(3);
    expect((await createPhoneContact(u.id, 0)).position).toBe(1);
    expect(positions(await fetchNotDeletedContactPositions(u.id))).toEqual([1, 2, 3, 4]);
  });

  it('scopes by type and owner independently', async () => {
    const { entity: u1 } = await createUser();
    const { entity: u2 } = await createUser();
    await createPhoneContact(u1.id);
    await createPhoneContact(u1.id);
    expect((await createEmailContact(u1.id)).position).toBe(2); // different type, after the user's own email
    expect((await createPhoneContact(u2.id)).position).toBe(1); // different owner
  });
});

describe('createManyAndReturn', () => {
  it('sequential append (all omitted)', async () => {
    const { entity: u } = await createUser();
    await createPhoneContact(u.id); // existing: 1
    const res = await db.contact.createManyAndReturn({
      data: [phoneContactData(u.id), phoneContactData(u.id), phoneContactData(u.id)],
    });
    expect(res.map((r) => r.position).sort()).toEqual([2, 3, 4]);
  });

  it('all fixed positions — shifts accumulate L→R', async () => {
    const { entity: u } = await createUser();
    await createPhoneContact(u.id); // 1
    await createPhoneContact(u.id); // 2
    await createPhoneContact(u.id); // 3
    const res = await db.contact.createManyAndReturn({
      data: [phoneContactData(u.id, 1), phoneContactData(u.id, 2), phoneContactData(u.id, 3)],
    });
    const rows = await fetchNotDeletedContactPositions(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4, 5, 6]);
    const newIds = new Set(res.map((r) => r.id));
    expect(
      rows
        .filter((r) => newIds.has(r.id))
        .map((r) => r.position)
        .sort(),
    ).toEqual([1, 2, 3]);
    expect(
      rows
        .filter((r) => !newIds.has(r.id))
        .map((r) => r.position)
        .sort(),
    ).toEqual([4, 5, 6]);
  });

  it('all at same position — LIFO order', async () => {
    const { entity: u } = await createUser();
    await createPhoneContact(u.id); // 1
    await createPhoneContact(u.id); // 2
    const res = await db.contact.createManyAndReturn({
      data: [phoneContactData(u.id, 1), phoneContactData(u.id, 1), phoneContactData(u.id, 1)],
    });
    const rows = await fetchNotDeletedContactPositions(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4, 5]);
    expect(positionOfContact(rows, res[2].id)).toBe(1);
    expect(positionOfContact(rows, res[1].id)).toBe(2);
    expect(positionOfContact(rows, res[0].id)).toBe(3);
  });

  it('mixed fixed + append', async () => {
    const { entity: u } = await createUser();
    await createPhoneContact(u.id); // 1
    await createPhoneContact(u.id); // 2
    await createPhoneContact(u.id); // 3
    await db.contact.createManyAndReturn({
      data: [phoneContactData(u.id, 2), phoneContactData(u.id), phoneContactData(u.id, 1)],
    });
    const rows = await fetchNotDeletedContactPositions(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('scattered fixed positions', async () => {
    const { entity: u } = await createUser();
    for (let i = 0; i < 5; i++) await createPhoneContact(u.id); // [1..5]
    const res = await db.contact.createManyAndReturn({
      data: [phoneContactData(u.id, 2), phoneContactData(u.id, 4)],
    });
    const rows = await fetchNotDeletedContactPositions(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(positionOfContact(rows, res[0].id)).toBe(2);
    expect(positionOfContact(rows, res[1].id)).toBe(4);
  });
});

describe('multi-scope isolation — createManyAndReturn', () => {
  it('rows for two different owners get independent sequences', async () => {
    const { entity: u1 } = await createUser();
    const { entity: u2 } = await createUser();
    await createPhoneContact(u1.id); // u1 existing @1

    await db.contact.createManyAndReturn({
      data: [phoneContactData(u2.id), phoneContactData(u1.id), phoneContactData(u2.id)],
    });

    expect(positions(await fetchNotDeletedContactPositions(u1.id))).toEqual([1, 2]);
    expect(positions(await fetchNotDeletedContactPositions(u2.id))).toEqual([1, 2]);
  });

  it('rows for two different types (same owner) get independent sequences', async () => {
    const { entity: u } = await createUser();
    await createPhoneContact(u.id); // phone @1

    await db.contact.createManyAndReturn({
      data: [
        phoneContactData(u.id),
        {
          ownerModel: ContactOwnerModel.User,
          userId: u.id,
          type: ContactType.email,
          value: { address: `a${nextFactorySequenceNumber()}@ex.com` },
        },
        phoneContactData(u.id),
      ],
    });

    expect(positions(await fetchNotDeletedContactPositions(u.id, ContactType.phone))).toEqual([
      1, 2, 3,
    ]);
    expect(positions(await fetchNotDeletedContactPositions(u.id, ContactType.email))).toEqual([
      1, 2,
    ]);
  });
});
