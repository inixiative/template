import { afterEach, describe, expect, it } from 'bun:test';
import { db, type OwnerKeys, whereAxisCarriesOwnerKeys } from '@template/db';
import type { Prisma } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createInquiry,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createProject,
  createSpace,
  createToken,
} from '@template/db/test';

const sides = ['source', 'target'] as const;
const other = { source: 'target', target: 'source' } as const;

describe('an inquiry carries the owner keys of the delegate on each side (Aron, 2026-11-16)', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  const world = async () => {
    const { entity: organization } = await createOrganization();
    const { entity: member } = await createOrganizationUser({ role: 'owner' }, { organization });
    const { entity: space } = await createSpace({}, { organization });
    const organizationIntegration = (
      await createIntegration({ ownerModel: 'Organization', organizationId: organization.id })
    ).entity;
    const memberIntegration = (
      await createIntegration({
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: member.userId,
      })
    ).entity;
    const spaceIntegration = (
      await createIntegration({
        ownerModel: 'Space',
        organizationId: organization.id,
        spaceId: space.id,
      })
    ).entity;
    const tokenOf = async (integration: typeof organizationIntegration) =>
      (await createToken({ ownerModel: 'Integration' }, { integration })).entity;
    const project = (
      await createProject({ ownerModel: 'Organization', organizationId: organization.id })
    ).entity;
    return {
      organization,
      member,
      space,
      project,
      organizationIntegration,
      memberIntegration,
      spaceIntegration,
      organizationToken: await tokenOf(organizationIntegration),
      memberToken: await tokenOf(memberIntegration),
      spaceToken: await tokenOf(spaceIntegration),
    };
  };

  const inquiryOn = async (side: (typeof sides)[number], party: Record<string, unknown>) => {
    const { entity: admin } = await createOrganization();
    const { entity } = await createInquiry({
      [`${other[side]}Model`]: 'Organization',
      [`${other[side]}OrganizationId`]: admin.id,
      ...Object.fromEntries(
        Object.entries(party).map(([key, value]) => [
          `${side}${key.charAt(0).toUpperCase()}${key.slice(1)}`,
          value,
        ]),
      ),
    } as Parameters<typeof createInquiry>[0]);
    return db.inquiry.findUniqueOrThrow({ where: { id: entity.id } });
  };

  for (const side of sides) {
    it(`${side}: a token of an organization's integration carries the token, the integration and the organization`, async () => {
      const { organization, organizationIntegration, organizationToken } = await world();
      const inquiry = await inquiryOn(side, { model: 'Token', tokenId: organizationToken.id });
      expect(inquiry).toMatchObject({
        [`${side}TokenId`]: organizationToken.id,
        [`${side}IntegrationId`]: organizationIntegration.id,
        [`${side}OrganizationId`]: organization.id,
        [`${side}SpaceId`]: null,
        [`${side}UserId`]: null,
      });
    });

    it(`${side}: a member's integration carries the organization and the user; a project carries its owner`, async () => {
      const { organization, member, memberIntegration, project } = await world();
      expect(
        await inquiryOn(side, { model: 'Integration', integrationId: memberIntegration.id }),
      ).toMatchObject({
        [`${side}OrganizationId`]: organization.id,
        [`${side}UserId`]: member.userId,
        [`${side}SpaceId`]: null,
        [`${side}TokenId`]: null,
      });
      expect(await inquiryOn(side, { model: 'Project', projectId: project.id })).toMatchObject({
        [`${side}ProjectId`]: project.id,
        [`${side}OrganizationId`]: organization.id,
        [`${side}UserId`]: null,
      });
    });

    it(`${side}: each owner's list holds what is addressed to it and to what it holds, and nothing a member or space holds`, async () => {
      const w = await world();
      const parties: Record<string, Record<string, unknown>> = {
        organization: { model: 'Organization', organizationId: w.organization.id },
        organizationIntegration: {
          model: 'Integration',
          integrationId: w.organizationIntegration.id,
        },
        organizationToken: { model: 'Token', tokenId: w.organizationToken.id },
        project: { model: 'Project', projectId: w.project.id },
        member: {
          model: 'OrganizationUser',
          organizationId: w.organization.id,
          userId: w.member.userId,
        },
        memberIntegration: { model: 'Integration', integrationId: w.memberIntegration.id },
        memberToken: { model: 'Token', tokenId: w.memberToken.id },
        space: { model: 'Space', organizationId: w.organization.id, spaceId: w.space.id },
        spaceIntegration: { model: 'Integration', integrationId: w.spaceIntegration.id },
        spaceToken: { model: 'Token', tokenId: w.spaceToken.id },
      };
      const ids: Record<string, string> = {};
      for (const [name, party] of Object.entries(parties))
        ids[name] = (await inquiryOn(side, party)).id;

      const organizationId = w.organization.id;
      const views: Record<string, { owner: OwnerKeys; holds: string[] }> = {
        organization: {
          owner: { Organization: organizationId, Space: null, User: null },
          holds: ['organization', 'organizationIntegration', 'organizationToken', 'project'],
        },
        member: {
          owner: { Organization: organizationId, User: w.member.userId, Space: null },
          holds: ['member', 'memberIntegration', 'memberToken'],
        },
        user: {
          owner: { User: w.member.userId },
          holds: ['member', 'memberIntegration', 'memberToken'],
        },
        space: {
          owner: { Organization: organizationId, Space: w.space.id, User: null },
          holds: ['space', 'spaceIntegration', 'spaceToken'],
        },
        integration: {
          owner: { Integration: w.organizationIntegration.id },
          holds: ['organizationIntegration', 'organizationToken'],
        },
      };
      const listed = async (where: Record<string, unknown>) =>
        (
          await db.inquiry.findMany({
            where: { ...(where as Prisma.InquiryWhereInput), id: { in: Object.values(ids) } },
            select: { id: true },
          })
        )
          .map(({ id }) => Object.keys(ids).find((name) => ids[name] === id)!)
          .sort();

      for (const [view, { owner, holds }] of Object.entries(views)) {
        const carried = await listed(whereAxisCarriesOwnerKeys('Inquiry', `${side}Model`, owner));
        expect({ view, carried }).toEqual({ view, carried: [...holds].sort() });
      }
    });
  }

  it("a caller's own keys never stand: they are the delegate's, deleted or not", async () => {
    const { organization, organizationIntegration, organizationToken, member } = await world();
    const { entity: elsewhere } = await createOrganization();
    const forged = { organizationId: elsewhere.id, userId: member.userId };
    const owned = {
      targetTokenId: organizationToken.id,
      targetIntegrationId: organizationIntegration.id,
      targetOrganizationId: organization.id,
      targetUserId: null,
      targetSpaceId: null,
    };
    expect(
      await inquiryOn('target', { model: 'Token', tokenId: organizationToken.id, ...forged }),
    ).toMatchObject(owned);
    await db.token.update({ where: { id: organizationToken.id }, data: { deletedAt: new Date() } });
    expect(
      await inquiryOn('target', { model: 'Token', tokenId: organizationToken.id, ...forged }),
    ).toMatchObject(owned);
  });

  it("a space's move re-keys the inquiries addressed to it and to what it holds", async () => {
    const { space, spaceToken } = await world();
    const { entity: destination } = await createOrganization();
    const direct = await inquiryOn('target', {
      model: 'Space',
      organizationId: space.organizationId,
      spaceId: space.id,
    });
    const beneath = await inquiryOn('target', { model: 'Token', tokenId: spaceToken.id });
    await db.space.update({ where: { id: space.id }, data: { organizationId: destination.id } });
    for (const { id } of [direct, beneath])
      expect(await db.inquiry.findUniqueOrThrow({ where: { id } })).toMatchObject({
        targetOrganizationId: destination.id,
        targetSpaceId: space.id,
      });
  });
});
