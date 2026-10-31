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
      patch(`/api/v1/organizationUser/${target.id}/entitlements`, { add: [granted] }),
    );
  };

  const slack = { field: 'provider', operator: 'equals', value: 'slack' };
  const integrations = (path: string, actions: string[], where?: Record<string, unknown>) => ({
    ...entry('db:integration', ['db:organization', organization.id, path], actions),
    ...(where ? { where } : {}),
  });

  it("via organization: every Slack integration under the organization; its owner grants deleting them, not managing them, since members' are not the owner's to manage", async () => {
    expect((await grant('owner', integrations('organization', ['delete'], slack))).status).toBe(
      200,
    );
    expect((await grant('owner', integrations('organization', ['manage'], slack))).status).toBe(
      403,
    );
  });

  it("an admin grants them narrowed to the organization's own: managing those is manage on the organization (R81)", async () => {
    expect((await grant('admin', integrations('organization', ['manage'], slack))).status).toBe(
      403,
    );
    expect(
      (
        await grant(
          'admin',
          integrations('organization', ['manage'], {
            all: [slack, { field: 'ownerModel', operator: 'equals', value: 'Organization' }],
          }),
        )
      ).status,
    ).toBe(200);
  });

  it("a member does not: it cannot change a member's entitlements at all", async () => {
    const response = await grant('member', integrations('organization', ['manage'], slack));
    expect(response.status).toBe(403);
    expect(((await response.json()) as { message: string }).message).toBe('Access denied');
  });

  it("via space.organization: the spaces' own integrations, granted by the owner, not an admin", async () => {
    const theSpaces = { field: 'ownerModel', operator: 'equals', value: 'Space' };
    expect(
      (await grant('owner', integrations('space.organization', ['manage'], theSpaces))).status,
    ).toBe(200);
    expect(
      (await grant('admin', integrations('space.organization', ['manage'], theSpaces))).status,
    ).toBe(403);
  });

  it("via organizationUser.organization: members' integrations, which the owner reads and deletes but does not manage, and an admin does not touch", async () => {
    expect(
      (await grant('owner', integrations('organizationUser.organization', ['delete']))).status,
    ).toBe(200);
    expect(
      (await grant('owner', integrations('organizationUser.organization', ['manage']))).status,
    ).toBe(403);
    expect(
      (await grant('admin', integrations('organizationUser.organization', ['delete']))).status,
    ).toBe(403);
  });

  it('a where pinning a space elsewhere is judged under the anchor, not at that space', async () => {
    const { entity: other } = await createOrganization();
    const { entity: elsewhere } = await createSpace({}, { organization: other });
    const { entity: here, context } = await createOrganizationUser(
      { role: 'admin' },
      { organization },
    );
    const { entity: there } = await createOrganizationUser(
      { role: 'owner' },
      { organization: other, user: context.user },
    );
    const { entity: target } = await createOrganizationUser({ role: 'member' }, { organization });
    const app = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [here, there],
      mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    const pinnedElsewhere = integrations('space.organization', ['manage'], {
      field: 'spaceId',
      operator: 'equals',
      value: elsewhere.id,
    });
    const response = await app.fetch(
      patch(`/api/v1/organizationUser/${target.id}/entitlements`, { add: [pinnedElsewhere] }),
    );
    expect(response.status).toBe(403);
    expect(((await response.json()) as { message: string }).message).toBe(
      'A delegate holds your permissions or less',
    );
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
    const { entity: writerMember, context } = await createOrganizationUser(
      { role: 'admin' },
      { organization },
    );
    const { entity: wOther } = await createOrganizationUser(
      { role: 'owner' },
      { organization: other, user: context.user },
    );
    const app = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [writerMember, wOther],
      mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    const sendAtOther = entry(
      'db:inquiry',
      ['db:organization', other.id, 'targetOrganization'],
      ['send'],
    );
    const response = await app.fetch(
      patch(`/api/v1/organizationUser/${writerMember.id}/entitlements`, { add: [sendAtOther] }),
    );
    expect(response.status).toBe(403);
  });

  it('an anchor off the resource tree is a malformed grant, not a server error', async () => {
    const { entity: target } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: space } = await createSpace({}, { organization });
    const offTree = entry('db:organization', ['db:space', space.id, 'spaces'], ['read']);
    const response = await (await writer('owner')).fetch(
      patch(`/api/v1/organizationUser/${target.id}/entitlements`, { add: [offTree] }),
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
        patch(`/api/v1/organizationUser/${target.id}/entitlements`, { add: [mint] }),
      );
    };

    it('an admin cannot grant minting tokens of any role: an owner token needs own', async () => {
      expect((await grantTokens()).status).toBe(403);
    });

    it('minting is a person-only action: no one grants it, whatever the where pins (R94)', async () => {
      expect(
        (await grantTokens({ field: 'role', operator: 'equals', value: 'member' })).status,
      ).toBe(403);
      expect(
        (
          await grantTokens({
            all: [
              { field: 'role', operator: 'equals', value: 'member' },
              { field: 'ownerModel', operator: 'equals', value: 'Organization' },
            ],
          })
        ).status,
      ).toBe(403);
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
