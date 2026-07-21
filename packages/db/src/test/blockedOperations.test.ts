import { describe, expect, it } from 'bun:test';
import { db } from '@template/db';

describe('blocked operations', () => {
  it('createMany throws with guidance to use createManyAndReturn', async () => {
    await expect(async () =>
      db.user.createMany({
        data: [{ email: 'test1@example.com' }, { email: 'test2@example.com' }],
      }),
    ).toThrow('createMany is not supported');
  });

  it('updateMany throws with guidance to use updateManyAndReturn', async () => {
    await expect(async () =>
      db.user.updateMany({
        where: { id: 'nonexistent' },
        data: { name: 'test' },
      }),
    ).toThrow('updateMany is not supported');
  });

  it('rejects a create that passes select', async () => {
    await expect(async () =>
      db.user.create({
        data: { email: 'narrowed@example.com' },
        select: { id: true },
      }),
    ).toThrow('drop the select/omit');
  });

  it('rejects an update that passes omit', async () => {
    await expect(async () =>
      db.user.update({
        where: { id: 'nonexistent' },
        data: { name: 'test' },
        omit: { email: true },
      }),
    ).toThrow('drop the select/omit');
  });

  it('rejects a createManyAndReturn that passes select', async () => {
    await expect(async () =>
      db.user.createManyAndReturn({
        data: [{ email: 'narrowed@example.com' }],
        select: { id: true },
      }),
    ).toThrow('drop the select/omit');
  });
});
