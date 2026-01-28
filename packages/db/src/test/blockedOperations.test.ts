import { describe, it, expect } from 'bun:test';
import { db } from '@template/db';

describe('blocked operations', () => {
  it('createMany throws with guidance to use createManyAndReturn', async () => {
    const fn = async () =>
      db.user.createMany({
        data: [{ email: 'test1@example.com' }, { email: 'test2@example.com' }],
      });

    await expect(fn).toThrow('createMany is not supported');
  });

  it('updateMany throws with guidance to use updateManyAndReturn', async () => {
    const fn = async () =>
      db.user.updateMany({
        where: { id: 'nonexistent' },
        data: { name: 'test' },
      });

    await expect(fn).toThrow('updateMany is not supported');
  });
});
