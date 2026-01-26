import { describe, expect, it } from 'bun:test';
import { OrganizationRole, organizationId } from '@template/db';
import { createPermissions, setupOrgContext } from '@template/permissions';
import { canAssignRole } from '#/lib/permissions/canAssignRole';

const orgId = organizationId('test-org');

const setupPermix = async (role: 'owner' | 'admin' | 'member' | 'viewer') => {
  const permix = createPermissions();
  await setupOrgContext(permix, { role, orgId });
  return permix;
};

describe('canAssignRole', () => {
  describe('owner', () => {
    it('can assign owner', async () => {
      const permix = await setupPermix('owner');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.owner)).not.toThrow();
    });

    it('can assign admin', async () => {
      const permix = await setupPermix('owner');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.admin)).not.toThrow();
    });

    it('can assign member', async () => {
      const permix = await setupPermix('owner');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.member)).not.toThrow();
    });

    it('can assign viewer', async () => {
      const permix = await setupPermix('owner');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.viewer)).not.toThrow();
    });
  });

  describe('admin', () => {
    it('cannot assign owner', async () => {
      const permix = await setupPermix('admin');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.owner)).toThrow();
    });

    it('cannot assign admin', async () => {
      const permix = await setupPermix('admin');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.admin)).toThrow();
    });

    it('can assign member', async () => {
      const permix = await setupPermix('admin');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.member)).not.toThrow();
    });

    it('can assign viewer', async () => {
      const permix = await setupPermix('admin');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.viewer)).not.toThrow();
    });
  });

  describe('member', () => {
    it('cannot assign owner', async () => {
      const permix = await setupPermix('member');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.owner)).toThrow();
    });

    it('cannot assign admin', async () => {
      const permix = await setupPermix('member');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.admin)).toThrow();
    });

    it('cannot assign member', async () => {
      const permix = await setupPermix('member');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.member)).toThrow();
    });
  });

  describe('viewer', () => {
    it('cannot assign any role', async () => {
      const permix = await setupPermix('viewer');
      expect(() => canAssignRole(permix, orgId, OrganizationRole.viewer)).toThrow();
    });
  });

  describe('different org', () => {
    it('cannot assign to other org', async () => {
      const permix = await setupPermix('owner');
      const otherOrgId = organizationId('other-org');
      expect(() => canAssignRole(permix, otherOrgId, OrganizationRole.member)).toThrow();
    });
  });
});
