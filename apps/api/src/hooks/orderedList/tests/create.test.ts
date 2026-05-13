import { describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { createUser, getNextSeq } from '@template/db/test';
import { email, liveOrders, phone, phoneRow, posOf, positions } from './setup';

describe('create', () => {
  it('appends to end when position omitted', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    const c = await phone(u.id);
    expect([a.position, b.position, c.position]).toEqual([1, 2, 3]);
  });

  it('inserts at position and shifts siblings', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3
    const d = await phone(u.id, 2); // insert at 2

    expect(d.position).toBe(2);
    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4]);
    expect(posOf(rows, a.id)).toBe(1);
    expect(posOf(rows, d.id)).toBe(2);
    expect(posOf(rows, b.id)).toBe(3);
    expect(posOf(rows, c.id)).toBe(4);
  });

  it('clamps position to [1, MAX+1]', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    await phone(u.id);
    expect((await phone(u.id, 999)).position).toBe(3);
    expect((await phone(u.id, 0)).position).toBe(1);
    expect(positions(await liveOrders(u.id))).toEqual([1, 2, 3, 4]);
  });

  it('scopes by type and owner independently', async () => {
    const { entity: u1 } = await createUser();
    const { entity: u2 } = await createUser();
    await phone(u1.id);
    await phone(u1.id);
    expect((await email(u1.id)).position).toBe(1); // different type
    expect((await phone(u2.id)).position).toBe(1); // different owner
  });
});

describe('createManyAndReturn', () => {
  it('sequential append (all omitted)', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // existing: 1
    const res = await db.contact.createManyAndReturn({ data: [phoneRow(u.id), phoneRow(u.id), phoneRow(u.id)] });
    expect(res.map((r) => r.position).sort()).toEqual([2, 3, 4]);
  });

  it('all fixed positions — shifts accumulate L→R', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // 1
    await phone(u.id); // 2
    await phone(u.id); // 3
    const res = await db.contact.createManyAndReturn({
      data: [phoneRow(u.id, 1), phoneRow(u.id, 2), phoneRow(u.id, 3)],
    });
    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4, 5, 6]);
    const newIds = new Set(res.map((r) => r.id));
    expect(rows.filter((r) => newIds.has(r.id)).map((r) => r.position).sort()).toEqual([1, 2, 3]);
    expect(rows.filter((r) => !newIds.has(r.id)).map((r) => r.position).sort()).toEqual([4, 5, 6]);
  });

  it('all at same position — LIFO order', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // 1
    await phone(u.id); // 2
    const res = await db.contact.createManyAndReturn({
      data: [phoneRow(u.id, 1), phoneRow(u.id, 1), phoneRow(u.id, 1)],
    });
    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4, 5]);
    expect(posOf(rows, res[2].id)).toBe(1);
    expect(posOf(rows, res[1].id)).toBe(2);
    expect(posOf(rows, res[0].id)).toBe(3);
  });

  it('mixed fixed + append', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // 1
    await phone(u.id); // 2
    await phone(u.id); // 3
    await db.contact.createManyAndReturn({
      data: [phoneRow(u.id, 2), phoneRow(u.id), phoneRow(u.id, 1)],
    });
    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('scattered fixed positions', async () => {
    const { entity: u } = await createUser();
    for (let i = 0; i < 5; i++) await phone(u.id); // [1..5]
    const res = await db.contact.createManyAndReturn({
      data: [phoneRow(u.id, 2), phoneRow(u.id, 4)],
    });
    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(posOf(rows, res[0].id)).toBe(2);
    expect(posOf(rows, res[1].id)).toBe(4);
  });
});

describe('multi-scope isolation — createManyAndReturn', () => {
  it('rows for two different owners get independent sequences', async () => {
    const { entity: u1 } = await createUser();
    const { entity: u2 } = await createUser();
    await phone(u1.id); // u1 existing @1

    await db.contact.createManyAndReturn({
      data: [phoneRow(u2.id), phoneRow(u1.id), phoneRow(u2.id)],
    });

    expect(positions(await liveOrders(u1.id))).toEqual([1, 2]);
    expect(positions(await liveOrders(u2.id))).toEqual([1, 2]);
  });

  it('rows for two different types (same owner) get independent sequences', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // phone @1

    await db.contact.createManyAndReturn({
      data: [
        phoneRow(u.id),
        { ownerModel: ContactOwnerModel.User as const, userId: u.id, type: ContactType.email as const, value: { address: `a${getNextSeq()}@ex.com` } },
        phoneRow(u.id),
      ],
    });

    expect(positions(await liveOrders(u.id, ContactType.phone))).toEqual([1, 2, 3]);
    expect(positions(await liveOrders(u.id, ContactType.email))).toEqual([1]);
  });
});
