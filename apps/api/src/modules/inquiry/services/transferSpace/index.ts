import { db } from '@template/db';
import type { Space } from '@template/db/generated/client/client';
import { Role } from '@template/db/generated/client/enums';
import {
  type TransferSpaceContent,
  type TransferSpaceResolutionInput,
  transferSpaceContentSchema,
  transferSpaceResolutionInputSchema,
} from '@template/shared/inquiry';
import { emitAppEvent } from '#/appEvents/emit';
import { enqueueJob } from '#/jobs/enqueue';
import { makeError } from '#/lib/errors';
import { clearSpaceRowCaches } from '#/modules/inquiry/services/transferSpace/clearSpaceRowCaches';
import type { InquiryService } from '#/modules/inquiry/services/types';
import { validateSpaceSlugFree } from '#/modules/inquiry/validations/validateSpaceSlugFree';

export const transferSpaceService: InquiryService<
  TransferSpaceContent,
  TransferSpaceResolutionInput,
  TransferSpaceResolutionInput
> = {
  contentSchema: transferSpaceContentSchema,
  resolutionInputSchema: transferSpaceResolutionInputSchema,
  resolutionSchema: transferSpaceResolutionInputSchema,
  unique: 'untargeted',
  defaultExpirationDays: 30,
  autoApprove: async () => false,

  handleApprove: async (_c, inquiry, content, response) => {
    const spaceId = inquiry.sourceSpaceId!;
    const organizationId = inquiry.targetOrganizationId!;

    const [space] = await db.findForUpdate<Space>('Space', { id: spaceId }, { changesKey: true });
    if (!space) throw makeError({ status: 404, message: 'The space being transferred is gone' });
    const slug = response.slug ?? content.slug ?? space.slug;
    await validateSpaceSlugFree({ organizationId, slug });

    const transferredAt = new Date();
    // Tombstone any ProjectIntegration linking a project in this space to an integration outside
    // this space (e.g. an Org A integration that does not travel with the space).
    await db.projectIntegration.updateManyAndReturn({
      where: {
        project: { spaceId },
        OR: [{ integration: { spaceId: null } }, { integration: { spaceId: { not: spaceId } } }],
      },
      data: { deletedAt: transferredAt },
    });
    await db.billingResource.updateManyAndReturn({
      where: {
        OR: [
          { resourceSpaceId: spaceId },
          { resourceProject: { spaceId } },
          { resourceProjectIntegration: { project: { spaceId } } },
        ],
        AND: [
          {
            OR: [
              { billingAccount: { spaceId: null } },
              { billingAccount: { spaceId: { not: spaceId } } },
            ],
          },
        ],
      },
      data: { deletedAt: transferredAt },
    });
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
    db.onCommit(async () => {
      await enqueueJob('reconcileBillingGovernance', { organizationId, spaceId });
    });
    await emitAppEvent('space.updated', { space: moved });
    return { slug };
  },
};
