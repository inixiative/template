import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerOrderedListHook } from '#/hooks/orderedList/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerUserEmailContactHook } from '#/hooks/userEmailContact/hook';

registerRulesHook();
registerContactRulesHook();
registerOrderedListHook();
registerUserEmailContactHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
  clearHookRegistry();
});

describe('userEmailContact hook', () => {
  it('creates a normalized email contact for a new user', async () => {
    const { entity: user } = await createUser();
    const contacts = await db.contact.findMany({ where: { userId: user.id, type: 'email' } });
    expect(contacts).toHaveLength(1);
    expect((contacts[0].value as { address: string }).address).toBe(user.email.toLowerCase());
    expect(contacts[0].valueKey).toBe(user.email.toLowerCase());
    expect(contacts[0].source).toBe('user-creation');
  });

  it('leaves the contact unverified — channel-ownership verification is COMM-004, not auth', async () => {
    const { entity: user } = await createUser({ emailVerified: true });
    const contact = await db.contact.findFirstOrThrow({ where: { userId: user.id, type: 'email' } });
    expect(contact.verifiedAt).toBeNull();
  });

  it('does not create a second contact when the user already has one', async () => {
    const { entity: user } = await createUser();
    await db.user.update({ where: { id: user.id }, data: { name: 'touched' } });
    const contacts = await db.contact.findMany({ where: { userId: user.id, type: 'email' } });
    expect(contacts).toHaveLength(1);
  });
});
