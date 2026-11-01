import { db } from '@template/db';
import type { OrganizationUser, Space, SpaceUser } from '@template/db/generated/client/client';
import { InquiryResourceModel, Role } from '@template/db/generated/client/enums';
import {
  baseResolutionInputSchema,
  type TransferSpaceContent,
  transferSpaceContentSchema,
} from '@template/shared/inquiry';
import { groupBy } from 'lodash-es';
import { emitAppEvent } from '#/appEvents/emit';
import { clearSpaceRowCaches } from '#/modules/inquiry/handlers/transferSpace/clearSpaceRowCaches';
import type { InquiryHandler } from '#/modules/inquiry/handlers/types';
import { validateSpaceSlugFree } from '#/modules/inquiry/validations/validateSpaceSlugFree';

export const transferSpaceHandler: InquiryHandler<TransferSpaceContent> = {
  sources: [{ sourceModel: InquiryResourceModel.Space }],
  targets: [{ targetModel: InquiryResourceModel.Organization }],
  contentSchema: transferSpaceContentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  unique: 'untargeted',
  defaultExpirationDays: 30,
  autoApprove: async () => false,

  handleApprove: async (inquiry) => {
    const spaceId = inquiry.sourceSpaceId!;
    const organizationId = inquiry.targetOrganizationId!;

    const [space] = await db.findForUpdate<Space>('Space', { id: spaceId });
    await validateSpaceSlugFree({ organizationId, slug: space!.slug });

    const memberUserIds = (
      await db.withDeleted(() =>
        db.spaceUser.findMany({ where: { spaceId }, select: { userId: true } }),
      )
    ).map(({ userId }) => userId);
    const targetMembers = await db.findForUpdate<OrganizationUser>(
      'OrganizationUser',
      { organizationId, userId: { in: memberUserIds } },
      { upserting: true },
    );
    const sourceMembers = await db.findForUpdate<OrganizationUser>('OrganizationUser', {
      organizationId: space!.organizationId,
      userId: { in: memberUserIds },
    });
    const spaceUsers = await db.findForUpdate<SpaceUser>('SpaceUser', { spaceId });

    const transferredAt = new Date();
    const removals = spaceUsers.flatMap(({ userId, deletedAt }) => {
      if (deletedAt) return [];
      const targetMember = targetMembers.find((member) => member.userId === userId);
      if (targetMember && !targetMember.deletedAt) return [];
      return [{ userId, stamp: targetMember?.deletedAt ?? transferredAt }];
    });
    for (const [stamp, group] of Object.entries(
      groupBy(removals, ({ stamp }) => stamp.toISOString()),
    ))
      await db.spaceUser.updateManyAndReturn({
        where: { spaceId, deletedAt: null, userId: { in: group.map(({ userId }) => userId) } },
        data: { deletedAt: new Date(stamp) },
      });

    // why: a stamp equal to the space membership's makes reviving this membership revive it; transferredAt matches nothing.
    const newMemberships = spaceUsers
      .filter(({ userId }) => !targetMembers.some((member) => member.userId === userId))
      .map(({ userId, deletedAt }) => {
        const leftWithSourceOrg = sourceMembers.some(
          (member) =>
            member.userId === userId && member.deletedAt?.getTime() === deletedAt?.getTime(),
        );
        return {
          organizationId,
          userId,
          role: Role.member,
          deletedAt: deletedAt && leftWithSourceOrg ? deletedAt : transferredAt,
        };
      });
    if (newMemberships.length)
      await db.organizationUser.createManyAndReturn({ data: newMemberships });

    await clearSpaceRowCaches(spaceId, organizationId);
    const moved = await db.space.update({ where: { id: spaceId }, data: { organizationId } });
    await emitAppEvent('space.updated', { space: moved });
  },
};
