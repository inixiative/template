import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { ContactType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createContact, createUser } from '@template/db/test';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerOrderedListHook } from '#/hooks/orderedList/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { signUnsubscribe } from '#/lib/email/unsubscribe';
import { unsubscribeRouter } from '#/routes/unsubscribe';
import { createTestApp } from '#tests/createTestApp';

registerRulesHook();
registerContactRulesHook();
registerOrderedListHook();

const { fetch } = createTestApp({ mount: [(app) => app.route('/unsubscribe', unsubscribeRouter)] });

const post = (token: string) =>
  fetch(new Request(`http://localhost/unsubscribe?token=${encodeURIComponent(token)}`, { method: 'POST' }));

const emailContact = (user: { id: string }, address: string, acceptedKinds: ('platform' | 'marketing')[]) =>
  createContact({ ownerModel: 'User', type: ContactType.email, value: { address }, acceptedKinds }, { user });

afterAll(async () => {
  await cleanupTouchedTables(db);
  clearHookRegistry();
});

describe('unsubscribe endpoint', () => {
  it('drops the signed kind from the contact on a one-click POST', async () => {
    const { entity: user } = await createUser();
    const { entity: contact } = await emailContact(user, `unsub-${Date.now()}@example.com`, ['platform', 'marketing']);

    const res = await post(signUnsubscribe({ userId: user.id, contactId: contact.id, kind: 'marketing' }));
    expect(res.status).toBe(200);

    const after = await db.contact.findUniqueOrThrow({ where: { id: contact.id }, select: { acceptedKinds: true } });
    expect(after.acceptedKinds).toEqual(['platform']);
  });

  it('rejects an invalid token', async () => {
    expect((await post('garbage.sig')).status).toBe(400);
  });

  it('is a no-op for a kind the contact never accepted', async () => {
    const { entity: user } = await createUser();
    const { entity: contact } = await emailContact(user, `unsub2-${Date.now()}@example.com`, ['platform']);

    const res = await post(signUnsubscribe({ userId: user.id, contactId: contact.id, kind: 'marketing' }));
    expect(res.status).toBe(200);

    const after = await db.contact.findUniqueOrThrow({ where: { id: contact.id }, select: { acceptedKinds: true } });
    expect(after.acceptedKinds).toEqual(['platform']);
  });
});
