import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db, revive } from '@template/db';
import { ContactOwnerModel, InquiryResourceModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createContact,
  createInquiry,
  createOrganization,
  createSession,
  createSpace,
  createUser,
} from '@template/db/test';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';

registerSoftDeleteCascadeHook();
registerRulesHook();
registerContactRulesHook();

const spaceById = (id: string) => db.space.findUnique({ where: { id } });
const contactById = (id: string) => db.contact.findUnique({ where: { id } });

const makeTree = async () => {
  const { entity: org } = await createOrganization();
  const { entity: space } = await createSpace({}, { organization: org });
  const { entity: contact } = await createContact({ ownerModel: ContactOwnerModel.Space }, { space });
  return { org, space, contact };
};

const tombstoneOrg = (id: string) => db.organization.update({ where: { id }, data: { deletedAt: new Date() } });
const reviveOrg = (id: string) => revive(db.organization, { id });

describe('softDeleteCascade hook', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('tombstones column-bearing descendants recursively with the parent timestamp', async () => {
    const { org, space, contact } = await makeTree();

    const deleted = await tombstoneOrg(org.id);

    expect((await spaceById(space.id))?.deletedAt).toEqual(deleted.deletedAt);
    expect((await contactById(contact.id))?.deletedAt).toEqual(deleted.deletedAt);
  });

  it('revive restores exactly the subtree that died with the parent', async () => {
    const { org, space, contact } = await makeTree();

    await tombstoneOrg(org.id);
    await reviveOrg(org.id);

    expect((await spaceById(space.id))?.deletedAt).toBeNull();
    expect((await contactById(contact.id))?.deletedAt).toBeNull();
  });

  it('a child deleted independently keeps its own timestamp and stays dead through revive', async () => {
    const { org, space, contact } = await makeTree();
    const { entity: survivor } = await createContact({ ownerModel: ContactOwnerModel.Space }, { space });

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
    const { org, space } = await makeTree();

    await tombstoneOrg(org.id);
    const spaceDeletedAt = (await spaceById(space.id))?.deletedAt;

    await db.organization.update({ where: { id: org.id }, data: { deletedAt: new Date('2027-01-01T00:00:00Z') } });

    expect((await spaceById(space.id))?.deletedAt).toEqual(spaceDeletedAt);
  });

  it('an ordinary update that never touches deletedAt does not cascade', async () => {
    const { org, space } = await makeTree();

    await db.organization.update({ where: { id: org.id }, data: { name: 'renamed' } });

    expect((await spaceById(space.id))?.deletedAt).toBeNull();
  });

  it('exempt reference edges do not cascade: an inquiry outlives its sender', async () => {
    const { entity: sender } = await createOrganization();
    const { entity: target } = await createUser();
    const { entity: inquiry } = await createInquiry({
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: sender.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: target.id,
    });

    await db.organization.update({ where: { id: sender.id }, data: { deletedAt: new Date() } });

    expect((await db.inquiry.findUnique({ where: { id: inquiry.id } }))?.deletedAt).toBeNull();
  });

  it('revocation registry: tombstoning a user hard-deletes its sessions, and revive does not resurrect them', async () => {
    const { entity: user } = await createUser();
    const { entity: session } = await createSession({}, { user });

    await db.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    expect(await db.session.findUnique({ where: { id: session.id } })).toBeNull();

    await db.user.update({ where: { id: user.id }, data: { deletedAt: null } });
    expect(await db.session.findUnique({ where: { id: session.id } })).toBeNull();
  });
});
