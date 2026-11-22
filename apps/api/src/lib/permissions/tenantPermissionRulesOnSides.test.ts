import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
} from '@template/db/test';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { post } from '#tests/utils/request';

const { holds } = createTokenProbeApp();

let organization: Organization;
let other: Organization;
let space: Space;

beforeEach(async () => {
  ({ entity: organization } = await createOrganization());
  ({ entity: other } = await createOrganization());
  ({ entity: space } = await createSpace({}, { organization }));
});

afterEach(async () => {
  await cleanupTouchedTables(db);
});

const viewerKeyAt = async (at: Organization) => {
  const { entity: organizationUser } = await createOrganizationUser(
    { role: 'viewer' },
    { organization: at },
  );
  return (
    await createKeyedToken(
      { ownerModel: 'OrganizationUser', full: true, role: null },
      { organizationUser },
    )
  ).rawKey;
};

const whoeverReads = (relation: string) => ({ rel: relation, action: 'read' });

const fromOrganization = (
  source: Organization,
  target: { organization?: Organization; space?: Space },
) =>
  createInquiry({
    sourceModel: 'Organization',
    sourceOrganizationId: source.id,
    ...(target.space
      ? {
          targetModel: 'Space',
          targetOrganizationId: target.space.organizationId,
          targetSpaceId: target.space.id,
        }
      : { targetModel: 'Organization', targetOrganizationId: target.organization?.id }),
  });

describe("a tenant rule on an inquiry walks through the tenant's own side", () => {
  it('opens what the organization received to its viewers, and not what it sent', async () => {
    const key = await viewerKeyAt(organization);
    const { entity: received } = await fromOrganization(other, { organization });
    const { entity: sent } = await fromOrganization(organization, { organization: other });
    expect(await holds(key, 'inquiry', received.id, 'read')).toBe(false);

    await db.organization.update({
      where: { id: organization.id },
      data: {
        tenantPermissionRules: { 'db:inquiry': { read: whoeverReads('targetOrganization') } },
      },
    });
    expect(await holds(key, 'inquiry', received.id, 'read')).toBe(true);
    expect(await holds(key, 'inquiry', sent.id, 'read')).toBe(false);
    expect(await holds(await viewerKeyAt(other), 'inquiry', received.id, 'read')).toBe(false);
  });

  it("a space opens its own side; the organization's rule does not reach what its space received", async () => {
    const organizationViewer = await viewerKeyAt(organization);
    const { entity: spaceUser } = await createSpaceUser(
      { role: 'viewer' },
      { space, organization },
    );
    const spaceViewer = (
      await createKeyedToken({ ownerModel: 'SpaceUser', full: true, role: null }, { spaceUser })
    ).rawKey;
    const { entity: toSpace } = await fromOrganization(other, { space });
    expect(await holds(spaceViewer, 'inquiry', toSpace.id, 'read')).toBe(false);

    await db.space.update({
      where: { id: space.id },
      data: { tenantPermissionRules: { 'db:inquiry': { read: whoeverReads('targetSpace') } } },
    });
    expect(await holds(spaceViewer, 'inquiry', toSpace.id, 'read')).toBe(true);

    await db.organization.update({
      where: { id: organization.id },
      data: {
        tenantPermissionRules: { 'db:inquiry': { read: whoeverReads('targetOrganization') } },
      },
    });
    expect(await holds(organizationViewer, 'inquiry', toSpace.id, 'read')).toBe(false);
  });

  it('a stored rule off its side widens nothing', async () => {
    const key = await viewerKeyAt(organization);
    const { entity: received } = await fromOrganization(other, { organization });
    for (const read of [true, whoeverReads('sourceOrganization')]) {
      await db.organization.update({
        where: { id: organization.id },
        data: { tenantPermissionRules: { 'db:inquiry': { read } } },
      });
      expect(await holds(key, 'inquiry', received.id, 'read')).toBe(false);
    }
  });

  it("is refused by the route unless it walks through one of the organization's sides", async () => {
    const owner = await createOrganizationUser({ role: 'owner' }, { organization });
    const { fetch } = createTestApp({
      mockUser: owner.context.user,
      mockOrganizationUsers: [owner.entity],
      mount: [(app) => app.route('/api/v1/organization', organizationRouter)],
    });
    const set = async (rules: unknown) =>
      (
        await fetch(
          post(`/api/v1/organization/${organization.id}/setTenantPermissionRules`, {
            tenantPermissionRules: rules,
          }),
        )
      ).status;
    expect(await set({ 'db:inquiry': { read: true } })).toBe(422);
    expect(await set({ 'db:inquiry': { read: whoeverReads('targetUser') } })).toBe(422);
    expect(await set({ 'db:inquiry': { resolve: whoeverReads('targetOrganization') } })).toBe(422);
    expect(await set({ 'db:inquiry': { read: whoeverReads('targetOrganization') } })).toBe(200);
  });
});
