import { db } from '@template/db';
import type { OrganizationUser, Space, SpaceUser } from '@template/db/generated/client/client';
import { InquiryResourceModel, Role } from '@template/db/generated/client/enums';
import {
  baseResolutionInputSchema,
  type TransferSpaceContent,
  transferSpaceContentSchema,
} from '@template/shared/inquiry';
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
    await validateSpaceSlugFree(organizationId, space!.slug);

    const spaceUsers = await db.findForUpdate<SpaceUser>('SpaceUser', { spaceId });
    const targetMembers = await db.findForUpdate<OrganizationUser>(
      'OrganizationUser',
      { organizationId, userId: { in: spaceUsers.map(({ userId }) => userId) } },
      { upserting: true },
    );
    const liveInTarget = targetMembers
      .filter(({ deletedAt }) => !deletedAt)
      .map(({ userId }) => userId);
    const inTarget = targetMembers.map(({ userId }) => userId);

    await db.spaceUser.updateManyAndReturn({
      where: { spaceId, deletedAt: null, userId: { notIn: liveInTarget } },
      data: { deletedAt: new Date() },
    });

    const outsiders = await db.withDeleted(() =>
      db.spaceUser.findMany({
        where: { spaceId, userId: { notIn: inTarget } },
        select: { userId: true, deletedAt: true },
      }),
    );
    if (outsiders.length)
      await db.organizationUser.createManyAndReturn({
        data: outsiders.map(({ userId, deletedAt }) => ({
          organizationId,
          userId,
          role: Role.member,
          deletedAt,
        })),
      });

    await clearSpaceRowCaches(spaceId, organizationId);
    const moved = await db.space.update({ where: { id: spaceId }, data: { organizationId } });
    await emitAppEvent('space.updated', { space: moved });
  },
};
