import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createUser, getNextSeq } from '@template/db/test';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerOrderedListHook } from '#/hooks/orderedList/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { reorderInList } from '#/lib/prisma/orderedList';

registerRulesHook();
registerContactRulesHook();
registerOrderedListHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
  clearHookRegistry();
});

// --- Helpers ---

const e164 = () => `+1555${String(getNextSeq()).padStart(7, '0').slice(-7)}`;

const phone = (userId: string, sortOrder?: number) =>
  db.contact.create({
    data: {
      ownerModel: ContactOwnerModel.User,
      userId,
      type: ContactType.phone,
      value: { e164: e164(), country: 'US' },
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    },
  });

const phoneRow = (userId: string, sortOrder?: number) => ({
  ownerModel: ContactOwnerModel.User as const,
  userId,
  type: ContactType.phone as const,
  value: { e164: e164(), country: 'US' },
  ...(sortOrder !== undefined ? { sortOrder } : {}),
});

const email = (userId: string) =>
  db.contact.create({
    data: {
      ownerModel: ContactOwnerModel.User,
      userId,
      type: ContactType.email,
      value: { address: `test${getNextSeq()}@example.com` },
    },
  });

const liveOrders = (userId: string, type = ContactType.phone) =>
  db.contact.findMany({
    where: { userId, type, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  });

const allOrders = (userId: string, type = ContactType.phone) =>
  db.contact.findMany({
    where: { userId, type },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true, deletedAt: true },
  });

const positions = (rows: { sortOrder: number }[]) => rows.map((r) => r.sortOrder);

const posOf = (rows: { id: string; sortOrder: number }[], id: string) =>
  rows.find((r) => r.id === id)?.sortOrder;

const scope = (userId: string) => ({
  ownerModel: ContactOwnerModel.User,
  userId,
  type: ContactType.phone,
});

const softDelete = (id: string) =>
  db.contact.update({ where: { id }, data: { deletedAt: new Date() } });

const restore = (id: string) =>
  db.contact.update({ where: { id }, data: { deletedAt: null } });

// --- CREATE ---

describe('create', () => {
  it('appends to end when sortOrder omitted', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    const c = await phone(u.id);
    expect([a.sortOrder, b.sortOrder, c.sortOrder]).toEqual([1, 2, 3]);
  });

  it('inserts at position and shifts siblings', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3
    const d = await phone(u.id, 2); // insert at 2

    expect(d.sortOrder).toBe(2);
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
    expect((await phone(u.id, 999)).sortOrder).toBe(3);
    expect((await phone(u.id, 0)).sortOrder).toBe(1);
    expect(positions(await liveOrders(u.id))).toEqual([1, 2, 3, 4]);
  });

  it('scopes by type and owner independently', async () => {
    const { entity: u1 } = await createUser();
    const { entity: u2 } = await createUser();
    await phone(u1.id);
    await phone(u1.id);
    expect((await email(u1.id)).sortOrder).toBe(1); // different type
    expect((await phone(u2.id)).sortOrder).toBe(1); // different owner
  });
});

// --- CREATE MANY ---

describe('createManyAndReturn', () => {
  it('sequential append (all omitted)', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // existing: 1
    const res = await db.contact.createManyAndReturn({ data: [phoneRow(u.id), phoneRow(u.id), phoneRow(u.id)] });
    expect(res.map((r) => r.sortOrder).sort()).toEqual([2, 3, 4]);
  });

  it('all fixed positions — shifts accumulate L→R', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3
    // D@1, E@2, F@3: each shifts everything before the next insert
    const res = await db.contact.createManyAndReturn({
      data: [phoneRow(u.id, 1), phoneRow(u.id, 2), phoneRow(u.id, 3)],
    });
    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4, 5, 6]);
    const newIds = new Set(res.map((r) => r.id));
    expect(rows.filter((r) => newIds.has(r.id)).map((r) => r.sortOrder).sort()).toEqual([1, 2, 3]);
    expect(rows.filter((r) => !newIds.has(r.id)).map((r) => r.sortOrder).sort()).toEqual([4, 5, 6]);
  });

  it('all at same position — LIFO order', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // 1
    await phone(u.id); // 2
    // D@1, E@1, F@1: last insert ends up at 1
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
    // D@2, E=append, F@1
    const res = await db.contact.createManyAndReturn({
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

// --- SOFT DELETE ---

describe('soft delete', () => {
  it('negates sortOrder and compacts siblings', async () => {
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
    expect(deleted!.sortOrder).toBeLessThan(0);
  });

  it('stacks multiple deletes as descending negatives', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    const c = await phone(u.id);
    await softDelete(a.id);
    await softDelete(b.id);

    const all = await allOrders(u.id);
    const live = all.filter((r) => !r.deletedAt);
    const dead = all.filter((r) => r.deletedAt);
    expect(positions(live)).toEqual([1]);
    expect(dead.every((r) => r.sortOrder < 0)).toBe(true);
    expect(new Set(dead.map((r) => r.sortOrder)).size).toBe(2);
  });
});

// --- BULK SOFT DELETE ---

describe('bulk soft delete', () => {
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
    expect(all.every((r) => r.sortOrder < 0)).toBe(true);
    expect(new Set(all.map((r) => r.sortOrder)).size).toBe(3);
  });
});

// --- RESTORE ---

describe('restore', () => {
  it('appends to end of live list', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3
    await softDelete(b.id); // live: a=1, c=2
    await restore(b.id);

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(posOf(rows, b.id)).toBe(3);
  });
});

// --- BULK RESTORE ---

describe('bulk restore', () => {
  it('assigns sequential end positions', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3
    const d = await phone(u.id); // 4
    await softDelete(b.id);
    await softDelete(c.id);
    // live: a=1, d=2

    await db.contact.updateManyAndReturn({
      where: { id: { in: [b.id, c.id] } },
      data: { deletedAt: null },
    });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4]);
    const restored = rows.filter((r) => r.id === b.id || r.id === c.id);
    expect(restored.map((r) => r.sortOrder).sort()).toEqual([3, 4]);
  });
});

// --- HARD DELETE ---

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
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3
    const d = await phone(u.id); // 4
    const e = await phone(u.id); // 5

    await db.contact.deleteMany({ where: { id: { in: [b.id, d.id] } } });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
  });
});

// --- REORDER ---

describe('reorder', () => {
  it('3→1: shifts [1,3) up', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    const c = await phone(u.id);
    await reorderInList('Contact', scope(u.id), c.id, 3, 1);

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(posOf(rows, c.id)).toBe(1);
    expect(posOf(rows, a.id)).toBe(2);
    expect(posOf(rows, b.id)).toBe(3);
  });

  it('1→3: shifts (1,3] down', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    const c = await phone(u.id);
    await reorderInList('Contact', scope(u.id), a.id, 1, 3);

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(posOf(rows, b.id)).toBe(1);
    expect(posOf(rows, c.id)).toBe(2);
    expect(posOf(rows, a.id)).toBe(3);
  });

  it('no-op when from === to', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    await reorderInList('Contact', scope(u.id), a.id, 1, 1);

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2]);
    expect(posOf(rows, a.id)).toBe(1);
  });

  it('2→4 in a 4-item list', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    const c = await phone(u.id);
    const d = await phone(u.id);
    await reorderInList('Contact', scope(u.id), b.id, 2, 4);

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4]);
    expect(posOf(rows, a.id)).toBe(1);
    expect(posOf(rows, c.id)).toBe(2);
    expect(posOf(rows, d.id)).toBe(3);
    expect(posOf(rows, b.id)).toBe(4);
  });
});

// --- UPSERT ---

describe('upsert', () => {
  it('create path: appends to end', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // 1
    const result = await db.contact.upsert({
      where: { id: 'nonexistent' },
      create: { ...phoneRow(u.id) },
      update: {},
    });
    expect(result.sortOrder).toBe(2);
  });

  it('update path: restores un-deleted item to end', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    await softDelete(b.id);

    await db.contact.upsert({
      where: { id: b.id },
      create: { ...phoneRow(u.id) },
      update: { deletedAt: null },
    });

    const rows = await liveOrders(u.id);
    expect(posOf(rows, b.id)).toBe(2);
  });
});

// --- BULK SORTORDER MANIPULATION ---

describe('bulk sortOrder manipulation', () => {
  it('increment all — re-densifies to [1..N]', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    const c = await phone(u.id);

    await db.contact.updateManyAndReturn({
      where: { userId: u.id, type: ContactType.phone },
      data: { sortOrder: { increment: 1 } },
    });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    // Relative order preserved
    expect(posOf(rows, a.id)!).toBeLessThan(posOf(rows, b.id)!);
    expect(posOf(rows, b.id)!).toBeLessThan(posOf(rows, c.id)!);
  });

  it('decrement into zero/negative — re-densifies', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    await phone(u.id);
    await phone(u.id);

    await db.contact.updateManyAndReturn({
      where: { userId: u.id, type: ContactType.phone },
      data: { sortOrder: { decrement: 2 } },
    });

    expect(positions(await liveOrders(u.id))).toEqual([1, 2, 3]);
  });

  it('set all to same value — resolves by id', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    await phone(u.id);
    await phone(u.id);

    await db.contact.updateManyAndReturn({
      where: { userId: u.id, type: ContactType.phone },
      data: { sortOrder: 1 },
    });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(new Set(rows.map((r) => r.sortOrder)).size).toBe(3);
  });

  it('partial increment causing overlap — re-densifies', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    const c = await phone(u.id);
    const d = await phone(u.id);

    await db.contact.updateManyAndReturn({
      where: { id: { in: [b.id, c.id] } },
      data: { sortOrder: { increment: 2 } },
    });

    expect(positions(await liveOrders(u.id))).toEqual([1, 2, 3, 4]);
  });

  it('swap via sequential updates', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3

    await db.contact.update({ where: { id: b.id }, data: { sortOrder: 3 } });
    await db.contact.update({ where: { id: c.id }, data: { sortOrder: 2 } });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(posOf(rows, a.id)).toBe(1);
    expect(posOf(rows, c.id)).toBe(2);
    expect(posOf(rows, b.id)).toBe(3);
  });
});

// --- UNIQUE CONSTRAINT SAFETY ---

describe('unique constraint safety', () => {
  it('insert-at shifts before write (no collision)', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    await phone(u.id);
    await phone(u.id);
    expect((await phone(u.id, 2)).sortOrder).toBe(2);
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

  it('reorder parks at -1 first (no collision)', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    const c = await phone(u.id);
    await reorderInList('Contact', scope(u.id), c.id, 3, 1);
    expect(positions(await liveOrders(u.id))).toEqual([1, 2, 3]);
  });

  it('direct sortOrder update reorders (no collision)', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    const b = await phone(u.id);
    await phone(u.id);
    await db.contact.update({ where: { id: b.id }, data: { sortOrder: 1 } });
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

// --- DENSITY INVARIANT ---

describe('density invariant', () => {
  it('mixed create/delete/insert/restore stays [1..N]', async () => {
    const { entity: u } = await createUser();
    const items = [];
    for (let i = 0; i < 5; i++) items.push(await phone(u.id)); // [1..5]

    await softDelete(items[2].id);    // live: [1,2,3,4]
    await phone(u.id, 2);             // live: [1,2,3,4,5]
    await restore(items[2].id);       // live: [1,2,3,4,5,6]

    expect(positions(await liveOrders(u.id))).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
