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

  const grant = async (by: 'owner' | 'admin' | 'member', granted: Record<string, unknown>) => {
    const { entity: target } = await createOrganizationUser({ role: 'member' }, { organization });
    return (await writer(by)).fetch(
      patch(`/api/v1/organizationUser/${target.id}`, { entitlements: [granted] }),
    );
  };

  const slack = { field: 'provider', operator: 'equals', value: 'slack' };
  const integrations = (path: string, actions: string[], where?: Record<string, unknown>) => ({
    ...entry('db:integration', ['db:organization', organization.id, path], actions),
    ...(where ? { where } : {}),
  });

  it("via organization: the organization's own Slack integrations, granted by its owner", async () => {
    expect((await grant('owner', integrations('organization', ['manage'], slack))).status).toBe(
      200,
    );
  });

  it('and by an admin: managing them is manage on the organization', async () => {
    expect((await grant('admin', integrations('organization', ['manage'], slack))).status).toBe(
      200,
    );
  });

  it('a member does not', async () => {
    expect((await grant('member', integrations('organization', ['manage'], slack))).status).toBe(
      403,
    );
  });

  it("via space.organization: the spaces' integrations, granted by the owner, not an admin", async () => {
    expect((await grant('owner', integrations('space.organization', ['manage']))).status).toBe(200);
    expect((await grant('admin', integrations('space.organization', ['manage']))).status).toBe(403);
  });

  it("via organizationUser.organization: members' own integrations, which only their user manages", async () => {
    expect(
      (await grant('owner', integrations('organizationUser.organization', ['manage']))).status,
    ).toBe(403);
  });

  it('a where pinning a space elsewhere is judged under the anchor, not at that space', async () => {
    const { entity: other } = await createOrganization();
    const { entity: elsewhere } = await createSpace({}, { organization: other });
    expect(
      (
        await grant(
          'admin',
          integrations('space.organization', ['manage'], {
            field: 'spaceId',
            operator: 'equals',
            value: elsewhere.id,
          }),
        )
      ).status,
    ).toBe(403);
  });

  it('a path that does not end at the anchor is a malformed grant', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const wrongModel = entry('db:integration', ['db:space', space.id, 'organization'], ['read']);
    expect((await grant('owner', wrongModel)).status).toBe(422);
  });

  it('an anchor on another model needs a path; a self anchor has none', async () => {
    const { entity: space } = await createSpace({}, { organization });
    expect(
      (await grant('owner', entry('db:integration', ['db:space', space.id], ['read']))).status,
    ).toBe(422);
    expect(
      (await grant('owner', entry('db:space', ['db:space', space.id, 'organization'], ['read'])))
        .status,
    ).toBe(422);
  });

  it('send is not grantable from the target side: every way to send reads the source, which the path leaves unknown', async () => {
    const { entity: other } = await createOrganization();
    const { entity: wSeat, context } = await createOrganizationUser(
      { role: 'admin' },
      { organization },
    );
    const { entity: wOther } = await createOrganizationUser(
      { role: 'owner' },
      { organization: other, user: context.user },
    );
    const app = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [wSeat, wOther],
      mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    const sendAtOther = entry(
      'db:inquiry',
      ['db:organization', other.id, 'targetOrganization'],
      ['send'],
    );
    const response = await app.fetch(
      patch(`/api/v1/organizationUser/${wSeat.id}`, { entitlements: [sendAtOther] }),
    );
    expect(response.status).toBe(403);
  });

  it('an anchor off the resource tree is a malformed grant, not a server error', async () => {
    const { entity: target } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: space } = await createSpace({}, { organization });
    const offTree = entry('db:organization', ['db:space', space.id, 'spaces'], ['read']);
    const response = await (await writer('owner')).fetch(
      patch(`/api/v1/organizationUser/${target.id}`, { entitlements: [offTree] }),
    );
    expect(response.status).toBe(422);
  });

  describe('the pseudo record carries what the where pins; the rest is unknown', () => {
    const grantTokens = async (where?: Record<string, unknown>) => {
      const { entity: target } = await createOrganizationUser({ role: 'member' }, { organization });
      const mint = {
        ...entry('db:token', ['db:organization', organization.id, 'organization'], ['create']),
        ...(where ? { where } : {}),
      };
      return (await writer('admin')).fetch(
        patch(`/api/v1/organizationUser/${target.id}`, { entitlements: [mint] }),
      );
    };

    it('an admin cannot grant minting tokens of any role: an owner token needs own', async () => {
      expect((await grantTokens()).status).toBe(403);
    });

    it("an admin grants minting the organization's member tokens: the where pins the role", async () => {
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
