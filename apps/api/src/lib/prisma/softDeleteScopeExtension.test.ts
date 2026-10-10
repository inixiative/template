import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db, revive } from '@template/db';
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

const tombstone = (model: 'user' | 'organization' | 'contact' | 'organizationUser', id: string) =>
  db.delegate(model).update({ where: { id }, data: { deletedAt: new Date() } });

describe('softDeleteScope extension', () => {
  beforeAll(() => {
    registerTestTracker();
    registerSoftDeleteCascadeHook();
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('hides a soft-deleted row from an ordinary read with no hand-scoping', async () => {
    const { entity: user } = await createUser();
    await tombstone('user', user.id);

    expect(await db.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await db.user.findMany({ where: { id: user.id } })).toHaveLength(0);
  });

  it('keeps a request actor scoped — only the bypass flag unscopes, never who the caller is', async () => {
    const { entity: admin } = await createUser({ platformRole: 'superadmin' });
    const { entity: user } = await createUser();
    await tombstone('user', user.id);

    const found = await auditActorContext.scope({ ...nullAuditActor, actorUserId: admin.id }, () =>
      db.user.findUnique({ where: { id: user.id } }),
    );
    expect(found).toBeNull();
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

    expect(await db.organizationUser.findMany({ where: { userId: orgUser.userId } })).toHaveLength(
      0,
    );

    const loaded = await db.user.findUnique({
      where: { id: orgUser.userId },
      include: { organizationUsers: { where: { organization: { deletedAt: null } } } },
    });
    expect(loaded?.organizationUsers).toHaveLength(0);
  });

  it('scopes bare include trees automatically', async () => {
    const { entity: user } = await createUser();
    const { entity: liveContact } = await createContact(
      { ownerModel: ContactOwnerModel.User },
      { user },
    );
    const { entity: deadContact } = await createContact(
      { ownerModel: ContactOwnerModel.User },
      { user },
    );
    await tombstone('contact', deadContact.id);

    const loaded = await db.user.findUnique({
      where: { id: user.id },
      include: { contacts: true },
    });
    const ids = loaded?.contacts.map((c) => c.id) ?? [];
    expect(ids).toContain(liveContact.id);
    expect(ids).not.toContain(deadContact.id);
  });

  const userWithOneLiveOneDeadContact = async () => {
    const { entity: user } = await createUser();
    const { entity: liveContact } = await createContact(
      { ownerModel: ContactOwnerModel.User },
      { user },
    );
    const { entity: deadContact } = await createContact(
      { ownerModel: ContactOwnerModel.User },
      { user },
    );
    await tombstone('contact', deadContact.id);
    return { user, liveContact, deadContact };
  };

  it('scopes nested select trees', async () => {
    const { user, liveContact } = await userWithOneLiveOneDeadContact();

    const loaded = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, contacts: { select: { id: true } } },
    });
    expect(loaded?.contacts.map((c) => c.id)).toEqual([liveContact.id]);
  });

  it('counts only live rows in a _count select', async () => {
    const { user } = await userWithOneLiveOneDeadContact();

    const loaded = await db.user.findUnique({
      where: { id: user.id },
      select: { _count: { select: { contacts: true } } },
    });
    expect(loaded?._count.contacts).toBe(1);
  });

  it('scopes relation filters — a tombstoned child does not satisfy `some`', async () => {
    const { entity: onlyDead } = await createUser();
    const { entity: deadContact } = await createContact(
      { ownerModel: ContactOwnerModel.User },
      { user: onlyDead },
    );
    await tombstone('contact', deadContact.id);
    const { user: hasLive } = await userWithOneLiveOneDeadContact();

    const rows = await db.user.findMany({
      where: { id: { in: [onlyDead.id, hasLive.id] }, contacts: { some: {} } },
    });
    expect(rows.map((r) => r.id)).toEqual([hasLive.id]);
  });

  it('scopes count and groupBy (the lens count-plan position)', async () => {
    const { user } = await userWithOneLiveOneDeadContact();

    expect(await db.contact.count({ where: { userId: user.id } })).toBe(1);

    const groups = await db.contact.groupBy({
      by: ['userId'],
      where: { userId: user.id },
      _count: { _all: true },
    });
    expect(groups.map((g) => g._count._all)).toEqual([1]);
  });

  it('an explicit deletedAt in a where opts that level out — root and include', async () => {
    const { user, deadContact } = await userWithOneLiveOneDeadContact();

    const dead = await db.contact.findMany({
      where: { userId: user.id, deletedAt: { not: null } },
    });
    expect(dead.map((c) => c.id)).toEqual([deadContact.id]);

    const loaded = await db.user.findUnique({
      where: { id: user.id },
      include: { contacts: { where: { deletedAt: { not: null } } } },
    });
    expect(loaded?.contacts.map((c) => c.id)).toEqual([deadContact.id]);
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

    const updated = await db.withDeleted(() =>
      db.user.update({ where: { id: user.id }, data: { name: 'allowed' } }),
    );
    expect(updated.name).toBe('allowed');
  });

  it('revives a parent and its cascaded subtree with the extension active', async () => {
    const { entity: org } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization: org });
    const { entity: contact } = await createContact(
      { ownerModel: ContactOwnerModel.Space },
      { space },
    );

    await tombstone('organization', org.id);
    expect(await db.organization.findUnique({ where: { id: org.id } })).toBeNull();

    await revive(db.organization, { id: org.id });

    expect((await db.organization.findUnique({ where: { id: org.id } }))?.id).toBe(org.id);
    expect((await db.space.findUnique({ where: { id: space.id } }))?.id).toBe(space.id);
    expect((await db.contact.findUnique({ where: { id: contact.id } }))?.id).toBe(contact.id);
  });
});
