import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createContact, createUser, getNextSeq } from '@template/db/test';
import { resolveUserByContact } from '#/lib/identity/resolveUserByContact';

describe('resolveUserByContact', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const jid = (phoneSuffix: number) => `1555${String(phoneSuffix).padStart(7, '0').slice(-7)}@s.whatsapp.net`;

  it('returns the existing userId when a Contact is already registered for the JID', async () => {
    const seq = getNextSeq();
    const targetJid = jid(seq);
    const { entity: user } = await createUser();
    await createContact(
      {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: ContactType.whatsapp,
        valueKey: targetJid,
        value: { jid: targetJid },
      },
      { context: { user } },
    );

    const resolvedId = await resolveUserByContact({
      type: ContactType.whatsapp,
      valueKey: targetJid,
      value: { jid: targetJid },
    });

    expect(resolvedId).toBe(user.id);
  });

  // Stub-create paths exercise the auditLog hook, which uses `db` from the
  // request scope set up by prepareRequest middleware. Calling the helper
  // directly here would FK-violate against AuditLog.subjectUserId. Cover
  // those paths via integration tests in createTestApp instead.

  it('throws when the contact type has no toStubEmail (e.g. linkedin)', async () => {
    const handle = `nonstub-${getNextSeq()}`;
    await expect(
      resolveUserByContact({
        type: ContactType.linkedin,
        valueKey: `personal:${handle}`,
        value: { classifier: 'personal', handle },
      }),
    ).rejects.toThrow(/no toStubEmail/);
  });
});
