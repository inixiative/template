import { afterEach, describe, expect, it } from 'bun:test';
import { db, revive } from '@template/db';
import {
  ContactOwnerModel,
  InquiryResourceModel,
  InquiryStatus,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createContact,
  createInquiry,
  createOrganization,
  createSession,
  createSpace,
  createUser,
} from '@template/db/test';

const spaceById = (id: string) => db.withDeleted(() => db.space.findUnique({ where: { id } }));
const contactById = (id: string) => db.withDeleted(() => db.contact.findUnique({ where: { id } }));

const createOrganizationWithSpaceAndContact = async () => {
  const { entity: org } = await createOrganization();
  const { entity: space } = await createSpace({}, { organization: org });
  const { entity: contact } = await createContact(
    { ownerModel: ContactOwnerModel.Space },
    { space },
  );
  return { org, space, contact };
};

const tombstoneOrg = (id: string) =>
  db.organization.update({ where: { id }, data: { deletedAt: new Date() } });
const reviveOrg = (id: string) => revive(db.organization, { id });

describe('softDeleteCascade hook', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('tombstones column-bearing descendants recursively with the parent timestamp', async () => {
    const { org, space, contact } = await createOrganizationWithSpaceAndContact();

    const deleted = await tombstoneOrg(org.id);

    expect((await spaceById(space.id))?.deletedAt).toEqual(deleted.deletedAt);
    expect((await contactById(contact.id))?.deletedAt).toEqual(deleted.deletedAt);
  });

  it('revive restores exactly the subtree that died with the parent', async () => {
    const { org, space, contact } = await createOrganizationWithSpaceAndContact();

    await tombstoneOrg(org.id);
    await reviveOrg(org.id);

    expect((await spaceById(space.id))?.deletedAt).toBeNull();
    expect((await contactById(contact.id))?.deletedAt).toBeNull();
  });

  it('a revive written as a set operation restores the subtree too', async () => {
    const { org, space, contact } = await createOrganizationWithSpaceAndContact();

    await tombstoneOrg(org.id);
    await db.organization.updateManyAndReturn({
      where: { id: org.id, deletedAt: { not: null } },
      data: { deletedAt: { set: null } },
    });

    expect((await spaceById(space.id))?.deletedAt).toBeNull();
    expect((await contactById(contact.id))?.deletedAt).toBeNull();
  });

  it('a child deleted independently keeps its own timestamp and stays dead through revive', async () => {
    const { org, space, contact } = await createOrganizationWithSpaceAndContact();
    const { entity: survivor } = await createContact(
      { ownerModel: ContactOwnerModel.Space },
      { space },
    );

    const independent = await db.contact.update({
      where: { id: contact.id },
      data: { deletedAt: new Date('2026-01-01T00:00:00Z') },
    });

    await tombstoneOrg(org.id);
    await reviveOrg(org.id);

    expect((await spaceById(space.id))?.deletedAt).toBeNull();
    expect((await contactById(survivor.id))?.deletedAt).toBeNull();
    expect((await contactById(contact.id))?.deletedAt).toEqual(independent.deletedAt);
  });

  it('re-tombstoning an already-deleted row does not re-cascade', async () => {
    const { org, space } = await createOrganizationWithSpaceAndContact();

    await tombstoneOrg(org.id);
    const spaceDeletedAt = (await spaceById(space.id))?.deletedAt;

    await db.withDeleted(() =>
      db.organization.update({
        where: { id: org.id },
        data: { deletedAt: new Date('2027-01-01T00:00:00Z') },
      }),
    );

    expect((await spaceById(space.id))?.deletedAt).toEqual(spaceDeletedAt);
  });

  it('an ordinary update that never touches deletedAt does not cascade', async () => {
    const { org, space } = await createOrganizationWithSpaceAndContact();

    await db.organization.update({ where: { id: org.id }, data: { name: 'renamed' } });

    expect((await spaceById(space.id))?.deletedAt).toBeNull();
  });

  it("a party's tombstone cancels its open inquiries without burying them, and leaves its closed ones (Aron, 2026-11-16)", async () => {
    const { entity: sender } = await createOrganization();
    const { entity: target } = await createUser();
    const parties = {
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: sender.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: target.id,
    };
    const { entity: open } = await createInquiry({ ...parties, status: InquiryStatus.sent });
    const { entity: decided } = await createInquiry({ ...parties, status: InquiryStatus.denied });

    await db.organization.update({ where: { id: sender.id }, data: { deletedAt: new Date() } });

    const read = (id: string) =>
      db.withDeleted(() => db.inquiry.findUniqueOrThrow({ where: { id } }));
    expect(await read(open.id)).toMatchObject({
      status: InquiryStatus.canceled,
      expiresAt: null,
      deletedAt: null,
    });
    expect(await read(decided.id)).toMatchObject({ status: InquiryStatus.denied, deletedAt: null });
  });

  it('revocation registry: tombstoning a user hard-deletes its sessions, and revive does not resurrect them', async () => {
    const { entity: user } = await createUser();
    const { entity: session } = await createSession({}, { user });

    await db.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    expect(await db.session.findUnique({ where: { id: session.id } })).toBeNull();

    await db.withDeleted(() =>
      db.user.update({ where: { id: user.id }, data: { deletedAt: null } }),
    );
    expect(await db.session.findUnique({ where: { id: session.id } })).toBeNull();
  });
});
