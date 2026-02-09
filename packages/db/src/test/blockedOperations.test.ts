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
});
