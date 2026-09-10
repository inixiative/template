import { afterAll, describe, expect, it } from 'bun:test';
import { db, Prisma, unregisterDbInvariant } from '@template/db';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { registerUserEmailInvariantHook } from '#/hooks/userEmail/hook';

registerUserEmailInvariantHook();

afterAll(async () => {
  unregisterDbInvariant('userEmail');
  await cleanupTouchedTables(db);
});

const rejected = { status: 422, message: 'Validation failed' };

describe('userEmail invariant', () => {
  it('rejects a create with a malformed address as a 422', async () => {
    await expect(createUser({ email: 'n/a' })).rejects.toMatchObject(rejected);
  });

  it('rejects a non-transactional update that sets a malformed address, and leaves the row untouched', async () => {
    const { entity: user } = await createUser({ email: 'dana@acme.com' });

    expect(db.isInTxn()).toBe(false);
    await expect(db.user.update({ where: { id: user.id }, data: { email: 'no-at-sign' } })).rejects.toMatchObject(
      rejected,
    );

    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.email).toBe('dana@acme.com');
  });

  it('rejects an address with surrounding whitespace', async () => {
    const { entity: user } = await createUser({ email: 'dana2@acme.com' });

    await expect(db.user.update({ where: { id: user.id }, data: { email: ' ok@example.com ' } })).rejects.toMatchObject(
      rejected,
    );

    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.email).toBe('dana2@acme.com');
  });

  it('rejects inside db.txn as well', async () => {
    const { entity: user } = await createUser({ email: 'dana3@acme.com' });

    await expect(
      db.txn(() => db.user.update({ where: { id: user.id }, data: { email: 'still-not-an-address' } })),
    ).rejects.toMatchObject(rejected);

    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.email).toBe('dana3@acme.com');
  });

  it("accepts Prisma's { set } form and a well-formed address", async () => {
    const { entity: user } = await createUser({ email: 'dana4@acme.com' });

    await db.user.update({ where: { id: user.id }, data: { email: { set: 'dana.new@acme.com' } } });

    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.email).toBe('dana.new@acme.com');
  });

  it('does not block an unrelated update to a user carrying a legacy malformed email', async () => {
    const { entity: user } = await createUser({ email: 'dana5@acme.com', name: 'Dana' });
    await db.raw.$executeRaw(Prisma.sql`UPDATE "User" SET email = ${'dana acme com'} WHERE id = ${user.id}`);

    await db.user.update({ where: { id: user.id }, data: { name: 'Dana R.' } });

    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.name).toBe('Dana R.');
    expect(row.email).toBe('dana acme com');
  });
});
