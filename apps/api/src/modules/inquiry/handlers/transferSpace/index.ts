import { db } from '@template/db';
import type { Space } from '@template/db/generated/client/client';
import { InquiryResourceModel, Role } from '@template/db/generated/client/enums';
import {
  baseResolutionInputSchema,
  type TransferSpaceContent,
  transferSpaceContentSchema,
  transferSpaceResolutionInputSchema,
} from '@template/shared/inquiry';
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

    const transferredAt = new Date();
    await db.spaceUser.updateManyAndReturn({
      where: {
        spaceId,
        user: { organizationUsers: { none: { organizationId, deletedAt: null } } },
      },
      data: { deletedAt: transferredAt },
    });
    const members = await db.withDeleted(() =>
      db.spaceUser.findMany({ where: { spaceId }, select: { userId: true } }),
    );
    // why: the space membership's key needs this row; a stamp no space membership carries keeps a hire from reviving them.
    const keyHeldAt = new Date(transferredAt.getTime() - 1);
    await db.organizationUser.createManyAndReturn({
      data: members.map(({ userId }) => ({
        organizationId,
        userId,
        role: Role.member,
        deletedAt: keyHeldAt,
      })),
      skipDuplicates: true,
    });

    await clearSpaceRowCaches(spaceId, organizationId);
    const moved = await db.space.update({ where: { id: spaceId }, data: { organizationId, slug } });
    await emitAppEvent('space.updated', { space: moved });
  },
};
