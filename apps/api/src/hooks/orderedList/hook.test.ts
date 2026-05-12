import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createUser, getNextSeq } from '@template/db/test';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerOrderedListHook } from '#/hooks/orderedList/hook';
import { registerRulesHook } from '#/hooks/rules/hook';

registerRulesHook();
registerContactRulesHook();
registerOrderedListHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
  clearHookRegistry();
});

const e164 = (local: string) => `+1555${local.padStart(7, '0').slice(-7)}`;

const createPhone = (userId: string, overrides: Record<string, unknown> = {}) =>
  db.contact.create({
    data: {
      ownerModel: ContactOwnerModel.User,
      userId,
      type: ContactType.phone,
      value: { e164: e164(String(getNextSeq())), country: 'US' },
      ...overrides,
    },
  });

const createEmail = (userId: string, overrides: Record<string, unknown> = {}) =>
  db.contact.create({
    data: {
      ownerModel: ContactOwnerModel.User,
      userId,
      type: ContactType.email,
      value: { address: `test${getNextSeq()}@example.com` },
      ...overrides,
    },
  });

const getSortOrders = async (userId: string, type: ContactType) => {
  const rows = await db.contact.findMany({
    where: { userId, type, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  });
  return rows;
};

const getAllSortOrders = async (userId: string, type: ContactType) => {
  const rows = await db.contact.findMany({
    where: { userId, type },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true, deletedAt: true },
  });
  return rows;
};

// --- CREATE ---

describe('orderedList — create', () => {
  it('appends to end when sortOrder omitted', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id);
    const b = await createPhone(user.id);
    const c = await createPhone(user.id);

    expect(a.sortOrder).toBe(1);
    expect(b.sortOrder).toBe(2);
    expect(c.sortOrder).toBe(3);
  });

  it('inserts at specified position and shifts siblings', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    // Insert at position 2 — b and c should shift to 3 and 4
    const d = await createPhone(user.id, { sortOrder: 2 });

    expect(d.sortOrder).toBe(2);
    const orders = await getSortOrders(user.id, ContactType.phone);
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4]);
    expect(orders.find((r) => r.id === a.id)?.sortOrder).toBe(1);
    expect(orders.find((r) => r.id === d.id)?.sortOrder).toBe(2);
    expect(orders.find((r) => r.id === b.id)?.sortOrder).toBe(3);
    expect(orders.find((r) => r.id === c.id)?.sortOrder).toBe(4);
  });

  it('clamps out-of-bounds position to MAX+1', async () => {
    const { entity: user } = await createUser();
    await createPhone(user.id); // 1
    await createPhone(user.id); // 2

    const clamped = await createPhone(user.id, { sortOrder: 999 });
    expect(clamped.sortOrder).toBe(3); // clamped to MAX+1
  });

  it('clamps position < 1 to 1', async () => {
    const { entity: user } = await createUser();
    await createPhone(user.id); // 1
    await createPhone(user.id); // 2

    const clamped = await createPhone(user.id, { sortOrder: 0 });
    expect(clamped.sortOrder).toBe(1);
    const orders = await getSortOrders(user.id, ContactType.phone);
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2, 3]);
  });

  it('scopes by registry fields — different types are independent', async () => {
    const { entity: user } = await createUser();
    await createPhone(user.id); // phone: 1
    await createPhone(user.id); // phone: 2

    const email = await createEmail(user.id); // email: starts at 1
    expect(email.sortOrder).toBe(1);
  });

  it('scopes by owner — different users are independent', async () => {
    const { entity: user1 } = await createUser();
    const { entity: user2 } = await createUser();
    await createPhone(user1.id); // user1: 1
    await createPhone(user1.id); // user1: 2

    const first = await createPhone(user2.id); // user2: starts at 1
    expect(first.sortOrder).toBe(1);
  });
});

// --- CREATE MANY ---

const phoneData = (userId: string, overrides: Record<string, unknown> = {}) => ({
  ownerModel: ContactOwnerModel.User,
  userId,
  type: ContactType.phone,
  value: { e164: e164(String(getNextSeq())), country: 'US' },
  ...overrides,
});

describe('orderedList — createManyAndReturn', () => {
  it('assigns sequential positions when all omitted', async () => {
    const { entity: user } = await createUser();
    await createPhone(user.id); // 1 (existing)

    const results = await db.contact.createManyAndReturn({
      data: [phoneData(user.id), phoneData(user.id), phoneData(user.id)],
    });

    expect(results.map((r) => r.sortOrder).sort()).toEqual([2, 3, 4]);
  });

  it('all with fixed positions — shifts accumulate left-to-right', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    // Insert D at 1, E at 2, F at 3 — processed left-to-right:
    //   before D: [a=1, b=2, c=3]
    //   D at 1 → shift >=1 by +1: [a=2, b=3, c=4], D=1 → [D=1, a=2, b=3, c=4]
    //   E at 2 → shift >=2 by +1: [a=3, b=4, c=5], D=1 → [D=1, E=2, a=3, b=4, c=5]
    //   F at 3 → shift >=3 by +1: [a=4, b=5, c=6], D=1, E=2 → [D=1, E=2, F=3, a=4, b=5, c=6]
    const results = await db.contact.createManyAndReturn({
      data: [
        phoneData(user.id, { sortOrder: 1 }),
        phoneData(user.id, { sortOrder: 2 }),
        phoneData(user.id, { sortOrder: 3 }),
      ],
    });

    const orders = await getSortOrders(user.id, ContactType.phone);
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4, 5, 6]);
    // New items occupy 1, 2, 3; originals pushed to 4, 5, 6
    const newIds = new Set(results.map((r) => r.id));
    const newOrders = orders.filter((r) => newIds.has(r.id)).map((r) => r.sortOrder);
    const oldOrders = orders.filter((r) => !newIds.has(r.id)).map((r) => r.sortOrder);
    expect(newOrders.sort()).toEqual([1, 2, 3]);
    expect(oldOrders.sort()).toEqual([4, 5, 6]);
  });

  it('all at same position — each shifts the previous insert', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2

    // Insert D at 1, E at 1, F at 1 — processed left-to-right:
    //   D at 1 → shift >=1: [a=2, b=3], D=1 → [D=1, a=2, b=3]
    //   E at 1 → shift >=1: [D=2, a=3, b=4], E=1 → [E=1, D=2, a=3, b=4]
    //   F at 1 → shift >=1: [E=2, D=3, a=4, b=5], F=1 → [F=1, E=2, D=3, a=4, b=5]
    const results = await db.contact.createManyAndReturn({
      data: [
        phoneData(user.id, { sortOrder: 1 }),
        phoneData(user.id, { sortOrder: 1 }),
        phoneData(user.id, { sortOrder: 1 }),
      ],
    });

    const orders = await getSortOrders(user.id, ContactType.phone);
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4, 5]);
    // Last insert (F) ends up at 1, first insert (D) at 3
    expect(orders.find((r) => r.id === results[2].id)?.sortOrder).toBe(1);
    expect(orders.find((r) => r.id === results[1].id)?.sortOrder).toBe(2);
    expect(orders.find((r) => r.id === results[0].id)?.sortOrder).toBe(3);
  });

  it('mixed specified and unspecified positions', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    // D at pos 2, E no pos, F at pos 1 — processed left-to-right:
    //   D at 2 → shift >=2: [a=1, b=3, c=4], D=2 → [a=1, D=2, b=3, c=4]
    //   E append → MAX+1=5 → [a=1, D=2, b=3, c=4, E=5]
    //   F at 1 → shift >=1: [a=2, D=3, b=4, c=5, E=6], F=1 → [F=1, a=2, D=3, b=4, c=5, E=6]
    const results = await db.contact.createManyAndReturn({
      data: [
        phoneData(user.id, { sortOrder: 2 }),
        phoneData(user.id),
        phoneData(user.id, { sortOrder: 1 }),
      ],
    });

    const orders = await getSortOrders(user.id, ContactType.phone);
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(orders.find((r) => r.id === results[2].id)?.sortOrder).toBe(1); // F
    expect(orders.find((r) => r.id === results[0].id)?.sortOrder).toBe(3); // D (shifted by F's insert)
    expect(orders.find((r) => r.id === results[1].id)?.sortOrder).toBe(6); // E (shifted by F's insert)
  });

  it('scattered fixed positions into existing list', async () => {
    const { entity: user } = await createUser();
    // Build a list of 5
    const items = [];
    for (let i = 0; i < 5; i++) items.push(await createPhone(user.id));
    // [1, 2, 3, 4, 5]

    // Insert at positions 2 and 4 — processed left-to-right:
    //   D at 2 → shift >=2: items become [1, 3, 4, 5, 6], D=2 → 6 items, [1, 2, 3, 4, 5, 6]
    //   E at 4 → shift >=4: items at 4,5,6 shift to 5,6,7, E=4 → 7 items, [1, 2, 3, 4, 5, 6, 7]
    const results = await db.contact.createManyAndReturn({
      data: [
        phoneData(user.id, { sortOrder: 2 }),
        phoneData(user.id, { sortOrder: 4 }),
      ],
    });

    const orders = await getSortOrders(user.id, ContactType.phone);
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(orders.find((r) => r.id === results[0].id)?.sortOrder).toBe(2); // D
    expect(orders.find((r) => r.id === results[1].id)?.sortOrder).toBe(4); // E
  });

  it('all append — no shifts needed', async () => {
    const { entity: user } = await createUser();

    const results = await db.contact.createManyAndReturn({
      data: [phoneData(user.id), phoneData(user.id), phoneData(user.id)],
    });

    // Empty list → 1, 2, 3 — no shifts
    expect(results.map((r) => r.sortOrder).sort()).toEqual([1, 2, 3]);
    const orders = await getSortOrders(user.id, ContactType.phone);
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2, 3]);
  });
});

// --- BULK SOFT DELETE (updateManyAndReturn) ---

describe('orderedList — bulk soft delete', () => {
  it('compacts after bulk soft-deleting multiple items', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3
    const d = await createPhone(user.id); // 4
    const e = await createPhone(user.id); // 5

    // Bulk soft-delete b(2) and d(4)
    // Each previous row is processed against the shared data.
    // b at pos 2: → negative, compact >2 by -1 → [a=1, c=2, d=3, e=4]
    // d was at pos 4 but after b's compact it's at 3: → negative, compact >3 by -1 → [a=1, c=2, e=3]
    await db.contact.updateManyAndReturn({
      where: { id: { in: [b.id, d.id] } },
      data: { deletedAt: new Date() },
    });

    const live = await getSortOrders(user.id, ContactType.phone);
    expect(live.map((r) => r.sortOrder)).toEqual([1, 2, 3]);
    expect(live.find((r) => r.id === a.id)?.sortOrder).toBe(1);
    expect(live.find((r) => r.id === c.id)?.sortOrder).toBe(2);
    expect(live.find((r) => r.id === e.id)?.sortOrder).toBe(3);

    const all = await getAllSortOrders(user.id, ContactType.phone);
    const deleted = all.filter((r) => r.deletedAt != null);
    expect(deleted.length).toBe(2);
    expect(deleted.every((r) => r.sortOrder < 0)).toBe(true);
    expect(new Set(deleted.map((r) => r.sortOrder)).size).toBe(2); // distinct negatives
  });

  it('bulk soft-delete all items leaves empty live list', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    await db.contact.updateManyAndReturn({
      where: { userId: user.id, type: ContactType.phone },
      data: { deletedAt: new Date() },
    });

    const live = await getSortOrders(user.id, ContactType.phone);
    expect(live).toEqual([]);

    const all = await getAllSortOrders(user.id, ContactType.phone);
    expect(all.every((r) => r.sortOrder < 0)).toBe(true);
    expect(new Set(all.map((r) => r.sortOrder)).size).toBe(3); // all distinct
  });
});

// --- BULK RESTORE (updateManyAndReturn) ---

describe('orderedList — bulk restore', () => {
  it('restores multiple items to sequential end positions', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3
    const d = await createPhone(user.id); // 4

    // Soft-delete b and c
    await db.contact.update({ where: { id: b.id }, data: { deletedAt: new Date() } });
    await db.contact.update({ where: { id: c.id }, data: { deletedAt: new Date() } });
    // Live: [a=1, d=2]

    // Bulk restore b and c
    // b: → MAX+1=3, c: → MAX+1=4
    await db.contact.updateManyAndReturn({
      where: { id: { in: [b.id, c.id] } },
      data: { deletedAt: null },
    });

    const live = await getSortOrders(user.id, ContactType.phone);
    expect(live.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4]);
    expect(live.find((r) => r.id === a.id)?.sortOrder).toBe(1);
    expect(live.find((r) => r.id === d.id)?.sortOrder).toBe(2);
    // b and c at 3 and 4 (order may vary but both present and distinct)
    const restored = live.filter((r) => r.id === b.id || r.id === c.id);
    expect(restored.map((r) => r.sortOrder).sort()).toEqual([3, 4]);
  });
});

// --- SOFT DELETE ---

describe('orderedList — soft delete', () => {
  it('moves item to negative sortOrder and compacts siblings', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    // Soft-delete b (position 2)
    await db.contact.update({
      where: { id: b.id },
      data: { deletedAt: new Date() },
    });

    const live = await getSortOrders(user.id, ContactType.phone);
    expect(live.map((r) => r.sortOrder)).toEqual([1, 2]); // compacted
    expect(live.find((r) => r.id === a.id)?.sortOrder).toBe(1);
    expect(live.find((r) => r.id === c.id)?.sortOrder).toBe(2); // shifted down

    const deleted = await db.contact.findUnique({ where: { id: b.id } });
    expect(deleted?.sortOrder).toBeLessThan(0); // negative
  });

  it('stacks multiple soft-deletes as descending negatives', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    await db.contact.update({
      where: { id: a.id },
      data: { deletedAt: new Date() },
    });
    await db.contact.update({
      where: { id: b.id },
      data: { deletedAt: new Date() },
    });

    const all = await getAllSortOrders(user.id, ContactType.phone);
    const deleted = all.filter((r) => r.deletedAt != null);
    const live = all.filter((r) => r.deletedAt == null);

    // Live items stay dense
    expect(live.map((r) => r.sortOrder)).toEqual([1]);
    // Deleted items are both negative and distinct
    expect(deleted.every((r) => r.sortOrder < 0)).toBe(true);
    expect(new Set(deleted.map((r) => r.sortOrder)).size).toBe(2);
  });
});

// --- RESTORE ---

describe('orderedList — restore (un-delete)', () => {
  it('appends restored item to end of live list', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    // Soft-delete b
    await db.contact.update({
      where: { id: b.id },
      data: { deletedAt: new Date() },
    });

    // Live: a=1, c=2. Restore b.
    await db.contact.update({
      where: { id: b.id },
      data: { deletedAt: null },
    });

    const live = await getSortOrders(user.id, ContactType.phone);
    expect(live.map((r) => r.sortOrder)).toEqual([1, 2, 3]);
    expect(live.find((r) => r.id === b.id)?.sortOrder).toBe(3); // appended to end
  });
});

// --- HARD DELETE ---

describe('orderedList — hard delete', () => {
  it('compacts siblings after hard delete via Prisma', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    // Hard-delete b (position 2) via Prisma — hook fires after delete
    await db.contact.delete({ where: { id: b.id } });

    const live = await getSortOrders(user.id, ContactType.phone);
    expect(live.map((r) => r.sortOrder)).toEqual([1, 2]);
    expect(live.find((r) => r.id === a.id)?.sortOrder).toBe(1);
    expect(live.find((r) => r.id === c.id)?.sortOrder).toBe(2);
  });

  it('compacts after deleteMany', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3
    const d = await createPhone(user.id); // 4
    const e = await createPhone(user.id); // 5

    // Delete b(2) and d(4)
    // After hook: compact >2 by -1 → [a=1, c=2, d=3, e=4]
    //             compact >3 by -1 (d was at 4, now 3) → [a=1, c=2, e=3]
    await db.contact.deleteMany({
      where: { id: { in: [b.id, d.id] } },
    });

    const live = await getSortOrders(user.id, ContactType.phone);
    expect(live.map((r) => r.sortOrder)).toEqual([1, 2, 3]);
    expect(live.find((r) => r.id === a.id)?.sortOrder).toBe(1);
    expect(live.find((r) => r.id === c.id)?.sortOrder).toBe(2);
    expect(live.find((r) => r.id === e.id)?.sortOrder).toBe(3);
  });
});

// --- REORDER ---

describe('orderedList — reorder', () => {
  it('moves item forward (3→1) and shifts affected range', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    const { reorderInList } = await import('#/lib/prisma/orderedList');
    const scope = { ownerModel: ContactOwnerModel.User, userId: user.id, type: ContactType.phone };
    await reorderInList('Contact', scope, c.id, 3, 1);

    const orders = await getSortOrders(user.id, ContactType.phone);
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2, 3]);
    expect(orders.find((r) => r.id === c.id)?.sortOrder).toBe(1);
    expect(orders.find((r) => r.id === a.id)?.sortOrder).toBe(2);
    expect(orders.find((r) => r.id === b.id)?.sortOrder).toBe(3);
  });

  it('moves item backward (1→3) and shifts affected range', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    const { reorderInList } = await import('#/lib/prisma/orderedList');
    const scope = { ownerModel: ContactOwnerModel.User, userId: user.id, type: ContactType.phone };
    await reorderInList('Contact', scope, a.id, 1, 3);

    const orders = await getSortOrders(user.id, ContactType.phone);
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2, 3]);
    expect(orders.find((r) => r.id === b.id)?.sortOrder).toBe(1);
    expect(orders.find((r) => r.id === c.id)?.sortOrder).toBe(2);
    expect(orders.find((r) => r.id === a.id)?.sortOrder).toBe(3);
  });

  it('no-op when from === to', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2

    const { reorderInList } = await import('#/lib/prisma/orderedList');
    const scope = { ownerModel: ContactOwnerModel.User, userId: user.id, type: ContactType.phone };
    await reorderInList('Contact', scope, a.id, 1, 1);

    const orders = await getSortOrders(user.id, ContactType.phone);
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2]);
    expect(orders.find((r) => r.id === a.id)?.sortOrder).toBe(1);
  });

  it('move middle item to end (2→4) in a 4-item list', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3
    const d = await createPhone(user.id); // 4

    const { reorderInList } = await import('#/lib/prisma/orderedList');
    const scope = { ownerModel: ContactOwnerModel.User, userId: user.id, type: ContactType.phone };
    await reorderInList('Contact', scope, b.id, 2, 4);

    const orders = await getSortOrders(user.id, ContactType.phone);
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4]);
    expect(orders.find((r) => r.id === a.id)?.sortOrder).toBe(1);
    expect(orders.find((r) => r.id === c.id)?.sortOrder).toBe(2);
    expect(orders.find((r) => r.id === d.id)?.sortOrder).toBe(3);
    expect(orders.find((r) => r.id === b.id)?.sortOrder).toBe(4);
  });
});

// --- UPSERT ---

describe('orderedList — upsert', () => {
  it('assigns sortOrder on upsert-create path', async () => {
    const { entity: user } = await createUser();
    await createPhone(user.id); // 1

    const upserted = await db.contact.upsert({
      where: { id: 'nonexistent-id' },
      create: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
      update: {},
    });

    expect(upserted.sortOrder).toBe(2); // appended to end
  });

  it('restores sortOrder on upsert-update that un-deletes', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2

    // Soft-delete b
    await db.contact.update({
      where: { id: b.id },
      data: { deletedAt: new Date() },
    });

    // Upsert that restores b
    await db.contact.upsert({
      where: { id: b.id },
      create: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.phone,
        value: { e164: e164(String(getNextSeq())), country: 'US' },
      },
      update: { deletedAt: null },
    });

    const live = await getSortOrders(user.id, ContactType.phone);
    expect(live.find((r) => r.id === b.id)?.sortOrder).toBe(2); // restored to end
  });
});

// --- DENSITY INVARIANT ---

describe('orderedList — density invariant', () => {
  it('maintains dense [1..N] after mixed operations', async () => {
    const { entity: user } = await createUser();

    // Create 5
    const items = [];
    for (let i = 0; i < 5; i++) {
      items.push(await createPhone(user.id));
    }
    // [1, 2, 3, 4, 5]

    // Soft-delete #3
    await db.contact.update({
      where: { id: items[2].id },
      data: { deletedAt: new Date() },
    });
    // Live: [1, 2, 3, 4]

    // Insert at position 2
    await createPhone(user.id, { sortOrder: 2 });
    // Live: [1, 2, 3, 4, 5]

    // Restore #3 (appends to end)
    await db.contact.update({
      where: { id: items[2].id },
      data: { deletedAt: null },
    });
    // Live: [1, 2, 3, 4, 5, 6]

    const live = await getSortOrders(user.id, ContactType.phone);
    expect(live.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
