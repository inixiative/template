import { describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { ContactType } from '@template/db/generated/client/enums';
import { createUser } from '@template/db/test';
import { allOrders, liveOrders, mkEmail, phone, posOf, positions, softDelete } from './setup';

describe('soft delete', () => {
  it('negates position and compacts siblings', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3
    await softDelete(b.id);

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2]);
    expect(posOf(rows, a.id)).toBe(1);
    expect(posOf(rows, c.id)).toBe(2);

    const deleted = await db.contact.findUnique({ where: { id: b.id } });
    expect(deleted!.position).toBeLessThan(0);
  });

  it('stacks multiple deletes as descending negatives', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    await phone(u.id);
    await softDelete(a.id);
    await softDelete(b.id);

    const all = await allOrders(u.id);
    const live = all.filter((r) => !r.deletedAt);
    const dead = all.filter((r) => r.deletedAt);
    expect(positions(live)).toEqual([1]);
    expect(dead.every((r) => r.position < 0)).toBe(true);
    expect(new Set(dead.map((r) => r.position)).size).toBe(2);
  });
});

describe('bulk soft delete', () => {
  it('ignores rows that were already deleted (no clobber)', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2 — already soft-deleted before the bulk op
    const c = await phone(u.id); // 3
    await softDelete(b.id); // live: a=1, c=2; b: negative
    const bAfterFirstDelete = await db.contact.findUnique({ where: { id: b.id } });
    const bOldNeg = bAfterFirstDelete!.position;
    // Bulk-set deletedAt over a where-clause that matches BOTH live and the already-deleted row.
    // Only a and c should transition; b must keep its existing negative.
    await db.contact.updateManyAndReturn({
      where: { userId: u.id, type: ContactType.phone },
      data: { deletedAt: new Date() },
    });
    const all = await allOrders(u.id);
    const bAfter = all.find((r) => r.id === b.id)!;
    expect(bAfter.position).toBe(bOldNeg); // untouched
    // a and c should both be negative now (newly soft-deleted)
    const aAfter = all.find((r) => r.id === a.id)!;
    const cAfter = all.find((r) => r.id === c.id)!;
    expect(aAfter.position).toBeLessThan(0);
    expect(cAfter.position).toBeLessThan(0);
  });

  it('compacts after deleting multiple items', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3
    const d = await phone(u.id); // 4
    const e = await phone(u.id); // 5

    await db.contact.updateManyAndReturn({
      where: { id: { in: [b.id, d.id] } },
      data: { deletedAt: new Date() },
    });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(posOf(rows, a.id)).toBe(1);
    expect(posOf(rows, c.id)).toBe(2);
    expect(posOf(rows, e.id)).toBe(3);
  });

  it('bulk delete all leaves empty live list', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    await phone(u.id);
    await phone(u.id);

    await db.contact.updateManyAndReturn({
      where: { userId: u.id, type: ContactType.phone },
      data: { deletedAt: new Date() },
    });

    expect(await liveOrders(u.id)).toEqual([]);
    const all = await allOrders(u.id);
    expect(all.every((r) => r.position < 0)).toBe(true);
    expect(new Set(all.map((r) => r.position)).size).toBe(3);
  });
});

describe('hard delete', () => {
  it('compacts via Prisma delete', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3
    await db.contact.delete({ where: { id: b.id } });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2]);
    expect(posOf(rows, a.id)).toBe(1);
    expect(posOf(rows, c.id)).toBe(2);
  });

  it('deleteMany compacts in descending order', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // 1
    const b = await phone(u.id); // 2
    await phone(u.id); // 3
    const d = await phone(u.id); // 4
    await phone(u.id); // 5

    await db.contact.deleteMany({ where: { id: { in: [b.id, d.id] } } });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
  });
});

describe('multi-scope isolation — bulk soft-delete', () => {
  it('deleting across two owners compacts each list independently', async () => {
    const { entity: u1 } = await createUser();
    const { entity: u2 } = await createUser();
    const a1 = await phone(u1.id); await phone(u1.id); // u1: [1,2]
    const b2 = await phone(u2.id); await phone(u2.id); await phone(u2.id); // u2: [1,2,3]

    await db.contact.updateManyAndReturn({
      where: { id: { in: [a1.id, b2.id] } },
      data: { deletedAt: new Date() },
    });

    expect(positions(await liveOrders(u1.id))).toEqual([1]);
    expect(positions(await liveOrders(u2.id))).toEqual([1, 2]);
  });

  it('deleting across two types (same owner) compacts each list independently', async () => {
    const { entity: u } = await createUser();
    const pa = await phone(u.id); await phone(u.id); // phone: [1,2]
    const ea = await mkEmail(u.id); await mkEmail(u.id); // email: [1,2]

    await db.contact.updateManyAndReturn({
      where: { id: { in: [pa.id, ea.id] } },
      data: { deletedAt: new Date() },
    });

    expect(positions(await liveOrders(u.id, ContactType.phone))).toEqual([1]);
    expect(positions(await liveOrders(u.id, ContactType.email))).toEqual([1]);
  });
});

describe('multi-scope isolation — deleteMany', () => {
  it('deleting across two owners compacts each list independently', async () => {
    const { entity: u1 } = await createUser();
    const { entity: u2 } = await createUser();
    await phone(u1.id); const b1 = await phone(u1.id); await phone(u1.id);
    await phone(u2.id); const b2 = await phone(u2.id); await phone(u2.id);

    await db.contact.deleteMany({ where: { id: { in: [b1.id, b2.id] } } });

    expect(positions(await liveOrders(u1.id))).toEqual([1, 2]);
    expect(positions(await liveOrders(u2.id))).toEqual([1, 2]);
  });

  it('deleting across two types (same owner) compacts each list independently', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); const pb = await phone(u.id); await phone(u.id);
    await mkEmail(u.id); const eb = await mkEmail(u.id); await mkEmail(u.id);

    await db.contact.deleteMany({ where: { id: { in: [pb.id, eb.id] } } });

    expect(positions(await liveOrders(u.id, ContactType.phone))).toEqual([1, 2]);
    expect(positions(await liveOrders(u.id, ContactType.email))).toEqual([1, 2]);
  });
});
