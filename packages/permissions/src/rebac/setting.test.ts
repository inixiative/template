import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import { createPermissions, type PermissionEntry } from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';

const u1 = { id: 'u1' };
const u2 = { id: 'u2' };
const o1 = { id: 'o1' };
const s1 = { id: 's1', organizationId: 'o1', organization: o1 };
const m1 = { id: 'm1', organizationId: 'o1', userId: 'u1', organization: o1, user: u1 };
const sm1 = {
  id: 'sm1',
  organizationId: 'o1',
  spaceId: 's1',
  userId: 'u1',
  organization: o1,
  space: s1,
  user: u1,
};
const orgProject = {
  id: 'p1',
  ownerModel: 'Organization',
  organizationId: 'o1',
  organization: o1,
};
const memberProject = {
  id: 'p2',
  ownerModel: 'OrganizationUser',
  organizationId: 'o1',
  userId: 'u1',
  organizationUser: m1,
  organization: o1,
  user: u1,
};

const grant = (resource: string, id: string, action: string): PermissionEntry => ({
  resource,
  id,
  actions: { [action]: true },
});

const person = async (user: { id: string }, ...entries: PermissionEntry[]) => {
  const permix = createPermissions();
  await permix.setup([grant('db:user', user.id, 'own'), ...entries]);
  return permix;
};

const can = (permix: Awaited<ReturnType<typeof person>>, record: object, action: string) =>
  check(permix, rebacSchema, 'setting', record as HydratedRecord, action);

describe('db:setting ReBAC permissions across all 6 SettingResourceModel arms', () => {
  it('User settings: only the user reads, operates, manages, and deletes their own settings', async () => {
    const setting = { resourceModel: 'User', resourceUserId: 'u1', resourceUser: u1 };
    const self = await person(u1);
    const other = await person(u2);

    expect(can(self, setting, 'read')).toBe(true);
    expect(can(self, setting, 'operate')).toBe(true);
    expect(can(self, setting, 'manage')).toBe(true);
    expect(can(self, setting, 'create')).toBe(true);
    expect(can(self, setting, 'delete')).toBe(true);

    expect(can(other, setting, 'read')).toBe(false);
    expect(can(other, setting, 'manage')).toBe(false);
    expect(can(other, setting, 'delete')).toBe(false);
  });

  it('Organization settings: viewers read, members operate, admins and owners manage and delete', async () => {
    const setting = {
      resourceModel: 'Organization',
      resourceOrganizationId: 'o1',
      resourceOrganization: o1,
    };
    const viewer = await person(u1, grant('db:organization', 'o1', 'read'));
    const member = await person(u1, grant('db:organization', 'o1', 'operate'));
    const admin = await person(u1, grant('db:organization', 'o1', 'manage'));
    const outsider = await person(u2);

    expect(can(viewer, setting, 'read')).toBe(true);
    expect(can(viewer, setting, 'operate')).toBe(false);
    expect(can(viewer, setting, 'manage')).toBe(false);

    expect(can(member, setting, 'read')).toBe(true);
    expect(can(member, setting, 'operate')).toBe(true);
    expect(can(member, setting, 'manage')).toBe(false);

    expect(can(admin, setting, 'read')).toBe(true);
    expect(can(admin, setting, 'manage')).toBe(true);
    expect(can(admin, setting, 'create')).toBe(true);
    expect(can(admin, setting, 'delete')).toBe(true);

    expect(can(outsider, setting, 'read')).toBe(false);
    expect(can(outsider, setting, 'manage')).toBe(false);
  });

  it('Space settings: delegate through space (including org owner inheritance)', async () => {
    const setting = {
      resourceModel: 'Space',
      resourceOrganizationId: 'o1',
      resourceSpaceId: 's1',
      resourceSpace: s1,
    };
    const spaceAdmin = await person(u1, grant('db:space', 's1', 'manage'));
    const spaceMember = await person(u1, grant('db:space', 's1', 'operate'));
    const orgOwner = await person(u2, grant('db:organization', 'o1', 'own'));
    const orgAdmin = await person(u2, grant('db:organization', 'o1', 'manage'));

    expect(can(spaceAdmin, setting, 'manage')).toBe(true);
    expect(can(spaceMember, setting, 'read')).toBe(true);
    expect(can(spaceMember, setting, 'manage')).toBe(false);
    expect(can(orgOwner, setting, 'manage')).toBe(true);
    expect(can(orgAdmin, setting, 'read')).toBe(false);
  });

  it('OrganizationUser and SpaceUser settings: only the member manages/operates; org owner reads and deletes; admins have no access', async () => {
    const orgMemberSetting = {
      resourceModel: 'OrganizationUser',
      resourceOrganizationId: 'o1',
      resourceUserId: 'u1',
      resourceOrganizationUser: m1,
    };
    const spaceMemberSetting = {
      resourceModel: 'SpaceUser',
      resourceOrganizationId: 'o1',
      resourceSpaceId: 's1',
      resourceUserId: 'u1',
      resourceSpaceUser: sm1,
    };

    const memberSelf = await person(u1, grant('db:organization', 'o1', 'operate'));
    const orgAdmin = await person(u2, grant('db:organization', 'o1', 'manage'));
    const orgOwner = await person(u2, grant('db:organization', 'o1', 'own'));

    for (const setting of [orgMemberSetting, spaceMemberSetting]) {
      expect(can(memberSelf, setting, 'read')).toBe(true);
      expect(can(memberSelf, setting, 'operate')).toBe(true);
      expect(can(memberSelf, setting, 'manage')).toBe(true);
      expect(can(memberSelf, setting, 'delete')).toBe(true);

      expect(can(orgAdmin, setting, 'read')).toBe(false);
      expect(can(orgAdmin, setting, 'manage')).toBe(false);
      expect(can(orgAdmin, setting, 'delete')).toBe(false);

      expect(can(orgOwner, setting, 'read')).toBe(true);
      expect(can(orgOwner, setting, 'manage')).toBe(false);
      expect(can(orgOwner, setting, 'delete')).toBe(true);
    }
  });

  it('Project settings: delegate through resourceProject for both tenant-owned and member-owned projects', async () => {
    const orgProjectSetting = {
      resourceModel: 'Project',
      resourceProjectId: 'p1',
      resourceProject: orgProject,
    };
    const memberProjectSetting = {
      resourceModel: 'Project',
      resourceProjectId: 'p2',
      resourceProject: memberProject,
    };

    const orgAdmin = await person(u2, grant('db:organization', 'o1', 'manage'));
    const orgMember = await person(u1, grant('db:organization', 'o1', 'operate'));

    expect(can(orgAdmin, orgProjectSetting, 'manage')).toBe(true);
    expect(can(orgMember, orgProjectSetting, 'read')).toBe(true);
    expect(can(orgMember, orgProjectSetting, 'operate')).toBe(true);
    expect(can(orgMember, orgProjectSetting, 'manage')).toBe(false);

    expect(can(orgMember, memberProjectSetting, 'manage')).toBe(true);
    expect(can(orgAdmin, memberProjectSetting, 'read')).toBe(false);
    expect(can(orgAdmin, memberProjectSetting, 'manage')).toBe(false);
  });
});
