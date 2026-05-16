import { describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { ContactType } from '@template/db/generated/client/enums';
import { createUser } from '@template/db/test';
import { liveOrders, mkEmail, phone, positions, posOf, restore, softDelete } from './setup';

describe('restore', () => {
  it('appends to end of live list', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // 1
    const b = await phone(u.id); // 2
    await phone(u.id); // 3
    await softDelete(b.id); // live: a=1, c=2
    await restore(b.id);

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(posOf(rows, b.id)).toBe(3);
  });
});

describe('bulk restore', () => {
  it('ignores rows that were already live (no clobber)', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2 — will be soft-deleted then restored alongside live rows
    const c = await phone(u.id); // 3
    await softDelete(b.id); // live: a=1, c=2; deleted: b
    // Bulk-set deletedAt=null over a where-clause that matches BOTH live and deleted rows.
    // Only b should be re-slotted; a and c must keep their positions.
    await db.contact.updateManyAndReturn({
      where: { userId: u.id, type: ContactType.phone },
      data: { deletedAt: null },
    });
    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(posOf(rows, a.id)).toBe(1);
    expect(posOf(rows, c.id)).toBe(2);
    expect(posOf(rows, b.id)).toBe(3); // restored to end, didn't clobber a/c
  });

  it('assigns sequential end positions', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3
    await phone(u.id); // 4
    await softDelete(b.id);
    await softDelete(c.id);

    await db.contact.updateManyAndReturn({
      where: { id: { in: [b.id, c.id] } },
      data: { deletedAt: null },
    });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4]);
    const restored = rows.filter((r) => r.id === b.id || r.id === c.id);
    expect(restored.map((r) => r.position).sort()).toEqual([3, 4]);
  });
});

describe('multi-scope isolation — bulk restore', () => {
  it('restoring across two owners appends to each list independently', async () => {
    const { entity: u1 } = await createUser();
    const { entity: u2 } = await createUser();
    const a1 = await phone(u1.id);
    await phone(u1.id); // u1: [1,2]
    const a2 = await phone(u2.id);
    await phone(u2.id); // u2: [1,2]
    await softDelete(a1.id); // u1: [1]
    await softDelete(a2.id); // u2: [1]

    await db.contact.updateManyAndReturn({
      where: { id: { in: [a1.id, a2.id] } },
      data: { deletedAt: null },
    });

    expect(positions(await liveOrders(u1.id))).toEqual([1, 2]);
    expect(positions(await liveOrders(u2.id))).toEqual([1, 2]);
  });

  it('restoring across two types (same owner) appends to each list independently', async () => {
    const { entity: u } = await createUser();
    const pa = await phone(u.id);
    await phone(u.id); // phone: [1,2]
    const ea = await mkEmail(u.id);
    await mkEmail(u.id); // email: [1,2]
    await softDelete(pa.id); // phone: [1]
    await softDelete(ea.id); // email: [1]

    await db.contact.updateManyAndReturn({
      where: { id: { in: [pa.id, ea.id] } },
      data: { deletedAt: null },
    });

    expect(positions(await liveOrders(u.id, ContactType.phone))).toEqual([1, 2]);
    expect(positions(await liveOrders(u.id, ContactType.email))).toEqual([1, 2]);
  });
});
