import { db } from '@template/db';
import type { Space } from '@template/db/generated/client/client';
import { InquiryResourceModel, Role } from '@template/db/generated/client/enums';
import {
  baseResolutionInputSchema,
  type TransferSpaceContent,
  transferSpaceContentSchema,
  transferSpaceResolutionInputSchema,
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
  resolutionInputSchema: transferSpaceResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  unique: 'untargeted',
  defaultExpirationDays: 30,
  autoApprove: async () => false,

  handleApprove: async (inquiry, content) => {
    const spaceId = inquiry.sourceSpaceId!;
    const organizationId = inquiry.targetOrganizationId!;

    const [space] = await db.findForUpdate<Space>('Space', { id: spaceId });
    const slug = content.slug ?? space!.slug;
    await validateSpaceSlugFree({ organizationId, slug });

    const users = await db.withDeleted(() =>
      db.user.findMany({
        where: {
          spaceUsers: { some: { spaceId } },
          organizationUsers: { none: { organizationId, deletedAt: null } },
        },
        select: {
          id: true,
          spaceUsers: { where: { spaceId }, select: { deletedAt: true } },
          organizationUsers: {
            where: { organizationId: { in: [organizationId, space!.organizationId] } },
            select: { organizationId: true, deletedAt: true },
          },
        },
      }),
    );
    const leaving = users.map(({ id, spaceUsers, organizationUsers }) => ({
      userId: id,
      spaceUser: spaceUsers[0]!,
      target: organizationUsers.find((member) => member.organizationId === organizationId),
      source: organizationUsers.find((member) => member.organizationId === space!.organizationId),
    }));

    const transferredAt = new Date();
    // why: a stamp equal to a tombstoned target membership's makes rehiring them revive this space membership.
    const removals = groupBy(
      leaving.filter(({ spaceUser }) => !spaceUser.deletedAt),
      ({ target }) => (target?.deletedAt ?? transferredAt).toISOString(),
    );
    for (const [stamp, group] of Object.entries(removals))
      await db.spaceUser.updateManyAndReturn({
        where: { spaceId, userId: { in: group.map(({ userId }) => userId) } },
        data: { deletedAt: new Date(stamp) },
      });

    // why: a stamp equal to the space membership's makes reviving this membership revive it; transferredAt matches nothing.
    const newMemberships = leaving
      .filter(({ target }) => !target)
      .map(({ userId, spaceUser: { deletedAt }, source }) => ({
        organizationId,
        userId,
        role: Role.member,
        deletedAt:
          deletedAt && source?.deletedAt?.getTime() === deletedAt.getTime()
            ? deletedAt
            : transferredAt,
      }));
    if (newMemberships.length)
      await db.organizationUser.createManyAndReturn({ data: newMemberships });

    await clearSpaceRowCaches(spaceId, organizationId);
    const moved = await db.space.update({ where: { id: spaceId }, data: { organizationId, slug } });
    await emitAppEvent('space.updated', { space: moved });
  },
};
