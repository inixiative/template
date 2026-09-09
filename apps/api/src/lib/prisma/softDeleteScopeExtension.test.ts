import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db, registerSoftDeleteScoper, revive } from '@template/db';
import { ContactOwnerModel } from '@template/db/generated/client/enums';
import { auditActorContext, nullAuditActor } from '@template/db/lib/auditActorContext';
import {
  cleanupTouchedTables,
  createContact,
  createOrganization,
  createOrganizationUser,
  createSession,
  createSpace,
  createUser,
  registerTestTracker,
} from '@template/db/test';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { liveIncludes, liveWhere } from '#/lib/prisma/softDeleteScope';

const tombstone = (model: 'user' | 'organization' | 'contact' | 'organizationUser', id: string) =>
  db[model].update({ where: { id }, data: { deletedAt: new Date() } });

const asSuperadmin = <T>(fn: () => Promise<T>): Promise<T> =>
  auditActorContext.scope({ ...nullAuditActor, platformSuperadmin: true }, async () => {
    return await fn();
  });

describe('softDeleteScope extension', () => {
  beforeAll(() => {
    registerTestTracker();
    registerSoftDeleteCascadeHook();
    registerSoftDeleteScoper({ liveWhere, liveIncludes });
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
    registerSoftDeleteScoper(null);
  });

  it('hides a soft-deleted row from an ordinary read with no hand-scoping', async () => {
    const { entity: user } = await createUser();
    await tombstone('user', user.id);

    expect(await db.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await db.user.findMany({ where: { id: user.id } })).toHaveLength(0);
  });

  it('returns a soft-deleted row for a superadmin caller', async () => {
    const { entity: user } = await createUser();
    await tombstone('user', user.id);

    const found = await asSuperadmin(() => db.user.findUnique({ where: { id: user.id } }));
    expect(found?.id).toBe(user.id);
  });

  it('withDeleted returns soft-deleted rows inside the scope and hides them outside', async () => {
    const { entity: user } = await createUser();
    await tombstone('user', user.id);

    const inside = await db.withDeleted(() => db.user.findUnique({ where: { id: user.id } }));
    expect(inside?.id).toBe(user.id);
    expect(await db.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it('hides a tombstoned membership on the permission read path (root and include tree)', async () => {
    const { entity: orgUser } = await createOrganizationUser();
    await tombstone('organizationUser', orgUser.id);

    expect(await db.organizationUser.findMany({ where: { userId: orgUser.userId } })).toHaveLength(0);

    const loaded = await db.user.findUnique({
      where: { id: orgUser.userId },
      include: { organizationUsers: { where: { organization: { deletedAt: null } } } },
    });
    expect(loaded?.organizationUsers).toHaveLength(0);
  });

  it('scopes bare include trees automatically', async () => {
    const { entity: user } = await createUser();
    const { entity: liveContact } = await createContact({ ownerModel: ContactOwnerModel.User }, { user });
    const { entity: deadContact } = await createContact({ ownerModel: ContactOwnerModel.User }, { user });
    await tombstone('contact', deadContact.id);

    const loaded = await db.user.findUnique({ where: { id: user.id }, include: { contacts: true } });
    const ids = loaded?.contacts.map((c) => c.id) ?? [];
    expect(ids).toContain(liveContact.id);
    expect(ids).not.toContain(deadContact.id);
  });

  it('leaves a model without a deletedAt column untouched', async () => {
    const { entity: user } = await createUser();
    const { entity: session } = await createSession({}, { user });

    const found = await db.session.findUnique({ where: { id: session.id } });
    expect(found?.id).toBe(session.id);
  });

  it('fails closed on writes to a dead row and lets withDeleted through', async () => {
    const { entity: user } = await createUser();
    await tombstone('user', user.id);

    await expect(
      (async () => db.user.update({ where: { id: user.id }, data: { name: 'blocked' } }))(),
    ).rejects.toThrow();

    const updated = await db.withDeleted(() => db.user.update({ where: { id: user.id }, data: { name: 'allowed' } }));
    expect(updated.name).toBe('allowed');
  });

  it('revives a parent and its cascaded subtree with the extension active', async () => {
    const { entity: org } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization: org });
    const { entity: contact } = await createContact({ ownerModel: ContactOwnerModel.Space }, { space });

    await tombstone('organization', org.id);
    expect(await db.organization.findUnique({ where: { id: org.id } })).toBeNull();

    await revive(db.organization, { id: org.id });

    expect((await db.organization.findUnique({ where: { id: org.id } }))?.id).toBe(org.id);
    expect((await db.space.findUnique({ where: { id: space.id } }))?.id).toBe(space.id);
    expect((await db.contact.findUnique({ where: { id: contact.id } }))?.id).toBe(contact.id);
  });
});
