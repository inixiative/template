import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createUser } from '@template/db/test';

afterEach(async () => {
  await cleanupTouchedTables(db);
});

describe('userEmailContact hook', () => {
  it('creates a normalized email contact for a new user', async () => {
    const { entity: user } = await createUser();
    const contacts = await db.contact.findMany({ where: { userId: user.id, type: 'email' } });
    expect(contacts).toHaveLength(1);
    expect((contacts[0].value as { address: string }).address).toBe(user.email.toLowerCase());
    expect(contacts[0].valueKey).toBe(user.email.toLowerCase());
    expect(contacts[0].source).toBe('userCreation');
  });

  it('leaves the contact unverified — channel-ownership verification is COMM-004, not auth', async () => {
    const { entity: user } = await createUser({ emailVerified: true });
    const contact = await db.contact.findFirstOrThrow({
      where: { userId: user.id, type: 'email' },
    });
    expect(contact.verifiedAt).toBeNull();
  });

  it('does not create a second contact when the user already has one', async () => {
    const { entity: user } = await createUser();
    await db.user.update({ where: { id: user.id }, data: { name: 'touched' } });
    const contacts = await db.contact.findMany({ where: { userId: user.id, type: 'email' } });
    expect(contacts).toHaveLength(1);
  });
});
