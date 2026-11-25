import { describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { ContactType } from '@template/db/generated/client/enums';
import { createUser } from '@template/db/test';
import {
  createEmailContact,
  createPhoneContact,
  fetchNotDeletedContactPositions,
  positionOfContact,
  positions,
  restoreContact,
  softDeleteContact,
} from '#/hooks/orderedList/tests/setup';

describe('restore', () => {
  it('appends to end of not-deleted list', async () => {
    const { entity: u } = await createUser();
    await createPhoneContact(u.id); // 1
    const b = await createPhoneContact(u.id); // 2
    await createPhoneContact(u.id); // 3
    await softDeleteContact(b.id); // not-deleted: a=1, c=2
    await restoreContact(b.id);

    const rows = await fetchNotDeletedContactPositions(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(positionOfContact(rows, b.id)).toBe(3);
  });
});

describe('bulk restore', () => {
  it('ignores rows that were already not deleted (no clobber)', async () => {
    const { entity: u } = await createUser();
    const a = await createPhoneContact(u.id); // 1
    const b = await createPhoneContact(u.id); // 2 — will be soft-deleted then restored alongside not-deleted rows
    const c = await createPhoneContact(u.id); // 3
    await softDeleteContact(b.id); // not-deleted: a=1, c=2; deleted: b
    // Bulk-set deletedAt=null over a where-clause that matches BOTH not-deleted and deleted rows.
    // Only b should be re-slotted; a and c must keep their positions.
    await db.withDeleted(() =>
      db.contact.updateManyAndReturn({
        where: { userId: u.id, type: ContactType.phone },
        data: { deletedAt: null },
      }),
    );
    const rows = await fetchNotDeletedContactPositions(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(positionOfContact(rows, a.id)).toBe(1);
    expect(positionOfContact(rows, c.id)).toBe(2);
    expect(positionOfContact(rows, b.id)).toBe(3); // restored to end, didn't clobber a/c
  });

  it('assigns sequential end positions', async () => {
    const { entity: u } = await createUser();
    await createPhoneContact(u.id); // 1
    const b = await createPhoneContact(u.id); // 2
    const c = await createPhoneContact(u.id); // 3
    await createPhoneContact(u.id); // 4
    await softDeleteContact(b.id);
    await softDeleteContact(c.id);

    await db.withDeleted(() =>
      db.contact.updateManyAndReturn({
        where: { id: { in: [b.id, c.id] } },
        data: { deletedAt: null },
      }),
    );

    const rows = await fetchNotDeletedContactPositions(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4]);
    const restored = rows.filter((r) => r.id === b.id || r.id === c.id);
    expect(restored.map((r) => r.position).sort()).toEqual([3, 4]);
  });
});

describe('multi-scope isolation — bulk restore', () => {
  it('restoring across two owners appends to each list independently', async () => {
    const { entity: u1 } = await createUser();
    const { entity: u2 } = await createUser();
    const a1 = await createPhoneContact(u1.id);
    await createPhoneContact(u1.id); // u1: [1,2]
    const a2 = await createPhoneContact(u2.id);
    await createPhoneContact(u2.id); // u2: [1,2]
    await softDeleteContact(a1.id); // u1: [1]
    await softDeleteContact(a2.id); // u2: [1]

    await db.withDeleted(() =>
      db.contact.updateManyAndReturn({
        where: { id: { in: [a1.id, a2.id] } },
        data: { deletedAt: null },
      }),
    );

    expect(positions(await fetchNotDeletedContactPositions(u1.id))).toEqual([1, 2]);
    expect(positions(await fetchNotDeletedContactPositions(u2.id))).toEqual([1, 2]);
  });

  it('restoring across two types (same owner) appends to each list independently', async () => {
    const { entity: u } = await createUser();
    const pa = await createPhoneContact(u.id);
    await createPhoneContact(u.id); // phone: [1,2]
    const ea = await createEmailContact(u.id);
    await createEmailContact(u.id); // email: [1,2,3] with the user's own
    await softDeleteContact(pa.id); // phone: [1]
    await softDeleteContact(ea.id); // email: [1,2]

    await db.withDeleted(() =>
      db.contact.updateManyAndReturn({
        where: { id: { in: [pa.id, ea.id] } },
        data: { deletedAt: null },
      }),
    );

    expect(positions(await fetchNotDeletedContactPositions(u.id, ContactType.phone))).toEqual([
      1, 2,
    ]);
    expect(positions(await fetchNotDeletedContactPositions(u.id, ContactType.email))).toEqual([
      1, 2, 3,
    ]);
  });
});
