import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import type { EntitlementInput } from '@template/db';
import { db } from '@template/db';
import type { Organization, Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createInquiry,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createToken,
} from '@template/db/test';
import { organizationUserRouter } from '#/modules/organizationUser';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { entitlementInputFor } from '#tests/utils/entitlementInputFor';
import { patch, post } from '#tests/utils/request';

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

const entitledKey = async (entitlements: EntitlementInput[]) => {
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

// why: a path admits every kind that carries its keys (R81); the where keeps the grant to the tenant's own side
const inquiries = (path: string, actions: string[] = ['read']) => {
  const side = path.startsWith('source') ? 'source' : 'target';
  return entitlementInputFor('db:Inquiry', ['db:Organization', organization.id, path], actions, {
    field: `${side}Model`,
    operator: Operator.equals,
    value: path.includes('Space') ? 'Space' : 'Organization',
  });
};

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
  const grant = async (role: 'owner' | 'admin', granted: EntitlementInput) => {
    const { entity: seat, context } = await createOrganizationUser({ role }, { organization });
    const { entity: target } = await createOrganizationUser({ role: 'member' }, { organization });
    const { app } = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [(hono) => hono.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    return (await app.fetch(post(`/api/v1/organizationUser/${target.id}/entitlements`, [granted])))
      .status;
  };

  it('an admin grants reading what the organization received: reading it is manage on the organization', async () => {
    expect(await grant('admin', inquiries('targetOrganization'))).toBe(201);
  });

  it("what its spaces received needs the owner: a space's inquiries need own on the organization", async () => {
    expect(await grant('owner', inquiries('targetSpace.organization'))).toBe(201);
    expect(await grant('admin', inquiries('targetSpace.organization'))).toBe(403);
  });

  it('a side that does not lead to the anchor is a malformed grant', async () => {
    expect(await grant('owner', inquiries('targetSpace'))).toBe(422);
  });
});

describe('reading by role: an organization reads the sides that name no person (Aron, 2026-11-16)', () => {
  const keyOf = async (organizationUser: Awaited<ReturnType<typeof createOrganizationUser>>) =>
    (
      await createKeyedToken(
        { ownerModel: 'OrganizationUser', full: true, role: null },
        { organizationUser: organizationUser.entity },
      )
    ).rawKey;

  it("an admin reads what the organization, its space and its integration token received; a member's own stay the member's", async () => {
    const admin = await createOrganizationUser({ role: 'admin' }, { organization });
    const member = await createOrganizationUser({ role: 'member' }, { organization });
    const tokenOf = async (owner: Parameters<typeof createIntegration>[0]) => {
      const { entity: integration } = await createIntegration(owner);
      const { entity: token } = await createToken({ ownerModel: 'Integration' }, { integration });
      return { integration, token };
    };
    const shared = await tokenOf({ ownerModel: 'Organization', organizationId: organization.id });
    const personal = await tokenOf({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: member.entity.userId,
    });
    const to = async (target: Record<string, unknown>) =>
      (
        await createInquiry({
          sourceModel: 'Organization',
          sourceOrganizationId: other.id,
          ...target,
        } as Parameters<typeof createInquiry>[0])
      ).entity.id;
    const inquiryIds = {
      organization: await to({
        targetModel: 'Organization',
        targetOrganizationId: organization.id,
      }),
      space: await to({
        targetModel: 'Space',
        targetOrganizationId: organization.id,
        targetSpaceId: space.id,
      }),
      sharedToken: await to({ targetModel: 'Token', targetTokenId: shared.token.id }),
      member: await to({
        targetModel: 'OrganizationUser',
        targetOrganizationId: organization.id,
        targetUserId: member.entity.userId,
      }),
      personalIntegration: await to({
        targetModel: 'Integration',
        targetIntegrationId: personal.integration.id,
      }),
      personalToken: await to({ targetModel: 'Token', targetTokenId: personal.token.id }),
    };
    const reads = async (key: string) =>
      Object.fromEntries(
        await Promise.all(
          Object.entries(inquiryIds).map(async ([name, id]) => [
            name,
            await holds(key, 'inquiry', id, 'read'),
          ]),
        ),
      );
    expect(await reads(await keyOf(admin))).toEqual({
      organization: true,
      space: false,
      sharedToken: true,
      member: false,
      personalIntegration: false,
      personalToken: false,
    });
    const { rawKey: personKey } = await createKeyedToken(
      { ownerModel: 'User', full: true, role: null },
      { user: member.context.user },
    );
    expect(await reads(personKey)).toEqual({
      organization: false,
      space: false,
      sharedToken: false,
      member: true,
      personalIntegration: true,
      personalToken: true,
    });
  });
});
