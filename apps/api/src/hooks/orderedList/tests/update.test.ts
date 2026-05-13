import { describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { ContactType } from '@template/db/generated/client/enums';
import { createUser } from '@template/db/test';
import { liveOrders, mkEmail, phone, phoneRow, posOf, positions, softDelete } from './setup';

describe('reorder via direct position update', () => {
  it('3→1: shifts [1,3) up', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    const b = await phone(u.id);
    const c = await phone(u.id);
    await db.contact.update({ where: { id: c.id }, data: { position: 1 } });

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
    await db.contact.update({ where: { id: a.id }, data: { position: 3 } });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(posOf(rows, b.id)).toBe(1);
    expect(posOf(rows, c.id)).toBe(2);
    expect(posOf(rows, a.id)).toBe(3);
  });

  it('no-op when target position equals current', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id);
    await phone(u.id);
    await db.contact.update({ where: { id: a.id }, data: { position: 1 } });

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
    await db.contact.update({ where: { id: b.id }, data: { position: 4 } });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3, 4]);
    expect(posOf(rows, a.id)).toBe(1);
    expect(posOf(rows, c.id)).toBe(2);
    expect(posOf(rows, d.id)).toBe(3);
    expect(posOf(rows, b.id)).toBe(4);
  });

  it('position beyond end clamps to last slot — no gap', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3

    // Sending position=999 or MAX+1 should clamp to 3 (last), not create a gap at 4.
    await db.contact.update({ where: { id: a.id }, data: { position: 999 } });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(posOf(rows, b.id)).toBe(1);
    expect(posOf(rows, c.id)).toBe(2);
    expect(posOf(rows, a.id)).toBe(3);
  });
});

describe('upsert', () => {
  it('create path: appends to end', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // 1
    const result = await db.contact.upsert({
      where: { id: 'nonexistent' },
      create: { ...phoneRow(u.id) },
      update: {},
    });
    expect(result.position).toBe(2);
  });

  it('update path: restores un-deleted item to end', async () => {
    const { entity: u } = await createUser();
    await phone(u.id); // 1
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

describe('bulk position manipulation', () => {
  it('throws on bulk increment', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    await phone(u.id);

    expect(
      (async () => db.contact.updateManyAndReturn({
        where: { userId: u.id, type: ContactType.phone },
        data: { position: { increment: 1 } },
      }))(),
    ).rejects.toThrow(/cannot be written via updateManyAndReturn/);
  });

  it('throws on bulk decrement', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    await phone(u.id);

    expect(
      (async () => db.contact.updateManyAndReturn({
        where: { userId: u.id, type: ContactType.phone },
        data: { position: { decrement: 1 } },
      }))(),
    ).rejects.toThrow(/cannot be written via updateManyAndReturn/);
  });

  it('throws on bulk set', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);

    expect(
      (async () => db.contact.updateManyAndReturn({
        where: { userId: u.id, type: ContactType.phone },
        data: { position: 5 },
      }))(),
    ).rejects.toThrow(/cannot be written via updateManyAndReturn/);
  });

  it('swap via sequential single updates', async () => {
    const { entity: u } = await createUser();
    const a = await phone(u.id); // 1
    const b = await phone(u.id); // 2
    const c = await phone(u.id); // 3

    await db.contact.update({ where: { id: b.id }, data: { position: 3 } });
    await db.contact.update({ where: { id: c.id }, data: { position: 2 } });

    const rows = await liveOrders(u.id);
    expect(positions(rows)).toEqual([1, 2, 3]);
    expect(posOf(rows, a.id)).toBe(1);
    expect(posOf(rows, c.id)).toBe(2);
    expect(posOf(rows, b.id)).toBe(3);
  });
});

describe('multi-scope isolation — bulk position write rejected', () => {
  it('throws even when matched rows span multiple owners', async () => {
    const { entity: u1 } = await createUser();
    const { entity: u2 } = await createUser();
    await phone(u1.id); await phone(u2.id);

    expect(
      (async () => db.contact.updateManyAndReturn({
        where: { userId: { in: [u1.id, u2.id] }, type: ContactType.phone },
        data: { position: { increment: 5 } },
      }))(),
    ).rejects.toThrow(/cannot be written via updateManyAndReturn/);
  });

  it('throws even when matched rows span multiple types', async () => {
    const { entity: u } = await createUser();
    await phone(u.id);
    await mkEmail(u.id);

    expect(
      (async () => db.contact.updateManyAndReturn({
        where: { userId: u.id },
        data: { position: { increment: 5 } },
      }))(),
    ).rejects.toThrow(/cannot be written via updateManyAndReturn/);
  });
});
