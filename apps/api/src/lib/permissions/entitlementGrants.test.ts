import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
} from '@template/db/test';
import { organizationUserRouter } from '#/modules/organizationUser';
import { createTestApp } from '#tests/createTestApp';
import { entry } from '#tests/utils/entitlementEntry';
import { patch } from '#tests/utils/request';

describe('granting entitlements from the organization (Aron, 2026-10-26)', () => {
  let organization: Organization;

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const writer = async (role: 'owner' | 'admin' | 'member') => {
    const { entity, context } = await createOrganizationUser({ role }, { organization });
    return createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [entity],
      mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
    });
  };

  const grantSlack = async (by: 'owner' | 'admin' | 'member', action: string) => {
    const { entity: target } = await createOrganizationUser({ role: 'member' }, { organization });
    const slackOnly = {
      ...entry('db:integration', ['db:organization', organization.id], [action]),
      where: { field: 'provider', operator: 'equals', value: 'slack' },
    };
    return (await writer(by)).fetch(
      patch(`/api/v1/organizationUser/${target.id}`, { entitlements: [slackOnly] }),
    );
  };

  it("an owner grants managing the organization's Slack integrations", async () => {
    expect((await grantSlack('owner', 'manage')).status).toBe(200);
  });

  it('an admin grants managing them too: managing organization integrations is manage', async () => {
    expect((await grantSlack('admin', 'manage')).status).toBe(200);
  });

  it('a member does not', async () => {
    expect((await grantSlack('member', 'manage')).status).toBe(403);
  });

  it('an anchor off the resource tree is a malformed grant, not a server error', async () => {
    const { entity: target } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: space } = await createSpace({}, { organization });
    const offTree = entry('db:organization', ['db:space', space.id], ['read']);
    const response = await (await writer('owner')).fetch(
      patch(`/api/v1/organizationUser/${target.id}`, { entitlements: [offTree] }),
    );
    expect(response.status).toBe(422);
  });

  describe('the pseudo record carries what the where pins; the rest is unknown', () => {
    const grantTokens = async (where?: Record<string, unknown>) => {
      const { entity: target } = await createOrganizationUser({ role: 'member' }, { organization });
      const mint = {
        ...entry('db:token', ['db:organization', organization.id], ['create']),
        ...(where ? { where } : {}),
      };
      return (await writer('admin')).fetch(
        patch(`/api/v1/organizationUser/${target.id}`, { entitlements: [mint] }),
      );
    };

    it('an admin cannot grant minting tokens of any role: an owner token needs own', async () => {
      expect((await grantTokens()).status).toBe(403);
    });

    it('an admin grants minting member tokens: the where pins the role', async () => {
      expect(
        (await grantTokens({ field: 'role', operator: 'equals', value: 'member' })).status,
      ).toBe(200);
    });

    it('a where that can hold on a missing value is malformed: write it positively', async () => {
      expect((await grantTokens({ field: 'role', operator: 'isEmpty' })).status).toBe(422);
    });

    it('a role in a list pins nothing: the admin is refused', async () => {
      expect(
        (await grantTokens({ field: 'role', operator: 'in', value: ['member', 'owner'] })).status,
      ).toBe(403);
    });
  });
});
