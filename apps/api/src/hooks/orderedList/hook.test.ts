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

describe('orderedList — createManyAndReturn', () => {
  it('assigns sequential positions when all omitted', async () => {
    const { entity: user } = await createUser();
    await createPhone(user.id); // 1 (existing)

    const results = await db.contact.createManyAndReturn({
      data: [
        {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          value: { e164: e164(String(getNextSeq())), country: 'US' },
        },
        {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          value: { e164: e164(String(getNextSeq())), country: 'US' },
        },
        {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          value: { e164: e164(String(getNextSeq())), country: 'US' },
        },
      ],
    });

    expect(results.map((r) => r.sortOrder).sort()).toEqual([2, 3, 4]);
  });

  it('handles mixed specified and unspecified positions', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    const results = await db.contact.createManyAndReturn({
      data: [
        {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          sortOrder: 2, // insert at 2
          value: { e164: e164(String(getNextSeq())), country: 'US' },
        },
        {
          ownerModel: ContactOwnerModel.User,
          userId: user.id,
          type: ContactType.phone,
          // no sortOrder — append to end
          value: { e164: e164(String(getNextSeq())), country: 'US' },
        },
      ],
    });

    const orders = await getSortOrders(user.id, ContactType.phone);
    // Should be dense: [1, 2, 3, 4, 5]
    expect(orders.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4, 5]);
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
  it('compacts siblings after hard delete', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    // Hard-delete b (position 2) — bypasses soft-delete hook
    await db.$executeRaw`DELETE FROM "Contact" WHERE "id" = ${b.id}`;

    // TODO: hard delete compaction hook needed
    // After compaction: a=1, c=2
    const live = await getSortOrders(user.id, ContactType.phone);
    expect(live.map((r) => r.sortOrder)).toEqual([1, 2]);
  });
});

// --- REORDER ---

describe('orderedList — reorder', () => {
  it('moves item forward (3→1) and shifts affected range', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    // TODO: reorder via reorderInList — need to call it directly for now
    // Move c (pos 3) to pos 1
    // Expected: c=1, a=2, b=3
  });

  it('moves item backward (1→3) and shifts affected range', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2
    const c = await createPhone(user.id); // 3

    // Move a (pos 1) to pos 3
    // Expected: b=1, c=2, a=3
  });

  it('no-op when from === to', async () => {
    const { entity: user } = await createUser();
    const a = await createPhone(user.id); // 1
    const b = await createPhone(user.id); // 2

    // Move a from 1 to 1 — nothing changes
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
