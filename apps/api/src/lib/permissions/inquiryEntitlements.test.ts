import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type { Organization, Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createSpace,
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { organizationUserRouter } from '#/modules/organizationUser';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { type Entry, entry } from '#tests/utils/entitlementEntry';
import { patch } from '#tests/utils/request';

const { holds } = createTokenProbeApp();

let organization: Organization;
let other: Organization;
let space: Space;

beforeAll(async () => {
  registerClearCacheHook();
  ({ entity: organization } = await createOrganization());
  ({ entity: other } = await createOrganization());
  ({ entity: space } = await createSpace({}, { organization }));
});

afterAll(async () => {
  unregisterDbHook('clearCache');
  await cleanupTouchedTables(db);
});

const entitledKey = async (entitlements: Entry[]) => {
  const { entity: organizationUser } = await createOrganizationUser(
    { role: 'viewer', entitlements },
    { organization },
  );
  return (
    await createKeyedToken(
      { ownerModel: 'OrganizationUser', full: true, role: null },
      { organizationUser },
    )
  ).rawKey;
};

const inquiries = (path: string, actions: string[] = ['read']) =>
  entry('db:inquiry', ['db:organization', organization.id, path], actions);

const fromOrganization = (
  source: Organization,
  target: { organization?: Organization; space?: Space },
) =>
  createInquiry({
    sourceModel: 'Organization',
    sourceOrganizationId: source.id,
    ...(target.space
      ? { targetModel: 'Space', targetSpaceId: target.space.id }
      : { targetModel: 'Organization', targetOrganizationId: target.organization?.id }),
  });

describe('an inquiry entitlement names a side and its kind (R74/R76)', () => {
  it('via targetOrganization: what the organization received, not what it sent', async () => {
    const key = await entitledKey([inquiries('targetOrganization')]);
    const { entity: received } = await fromOrganization(other, { organization });
    const { entity: sent } = await fromOrganization(organization, { organization: other });
    expect(await holds(key, 'inquiry', received.id, 'read')).toBe(true);
    expect(await holds(key, 'inquiry', sent.id, 'read')).toBe(false);
  });

  it('via sourceOrganization: what the organization sent, not what it received', async () => {
    const key = await entitledKey([inquiries('sourceOrganization')]);
    const { entity: received } = await fromOrganization(other, { organization });
    const { entity: sent } = await fromOrganization(organization, { organization: other });
    expect(await holds(key, 'inquiry', sent.id, 'read')).toBe(true);
    expect(await holds(key, 'inquiry', received.id, 'read')).toBe(false);
  });

  it('via targetSpace.organization: what its spaces received, not what the organization itself received', async () => {
    const key = await entitledKey([inquiries('targetSpace.organization')]);
    const { entity: toSpace } = await fromOrganization(other, { space });
    const { entity: toOrganization } = await fromOrganization(other, { organization });
    expect(await holds(key, 'inquiry', toSpace.id, 'read')).toBe(true);
    expect(await holds(key, 'inquiry', toOrganization.id, 'read')).toBe(false);
  });

  it('the organization on both sides: each side reaches it by its own path, the wrong kind does not', async () => {
    const { entity: internal } = await fromOrganization(organization, { space });
    expect(
      await holds(
        await entitledKey([inquiries('sourceOrganization')]),
        'inquiry',
        internal.id,
        'read',
      ),
    ).toBe(true);
    expect(
      await holds(
        await entitledKey([inquiries('targetSpace.organization')]),
        'inquiry',
        internal.id,
        'read',
      ),
    ).toBe(true);
    expect(
      await holds(
        await entitledKey([inquiries('targetOrganization')]),
        'inquiry',
        internal.id,
        'read',
      ),
    ).toBe(false);
  });
});

describe('granting inquiry entitlements: the writer could act on the side named', () => {
  const grant = async (role: 'owner' | 'admin', granted: Entry) => {
    const { entity: seat, context } = await createOrganizationUser({ role }, { organization });
    const { entity: target } = await createOrganizationUser({ role: 'member' }, { organization });
    const { app } = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [(hono) => hono.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    return (
      await app.fetch(
        patch(`/api/v1/organizationUser/${target.id}/entitlements`, { add: [granted] }),
      )
    ).status;
  };

  it('an admin grants reading what the organization received: reading it is manage on the organization', async () => {
    expect(await grant('admin', inquiries('targetOrganization'))).toBe(200);
  });

  it("what its spaces received needs the owner: a space's inquiries need own on the organization", async () => {
    expect(await grant('owner', inquiries('targetSpace.organization'))).toBe(200);
    expect(await grant('admin', inquiries('targetSpace.organization'))).toBe(403);
  });

  it('a side that does not lead to the anchor is a malformed grant', async () => {
    expect(await grant('owner', inquiries('targetSpace'))).toBe(422);
  });
});
