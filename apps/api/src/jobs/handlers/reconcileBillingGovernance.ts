/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses infrastructure:billing, infrastructure:prisma
 */
import { db } from '@template/db';
import { BillingAccountOwnerModel } from '@template/db/generated/client/enums';
import type { JobHandler } from '#/jobs/types';
import { isBillingOwnerAllowed } from '#/modules/billingAccount/services/billingGovernance';

export type ReconcileBillingGovernancePayload = {
  organizationId: string;
  spaceId?: string | null;
  userId?: string | null;
};

export const reconcileBillingGovernance: JobHandler<ReconcileBillingGovernancePayload> = async (
  _ctx,
  payload,
) => {
  const accounts = await db.billingAccount.findMany({
    where: {
      organizationId: payload.organizationId,
      ownerModel: {
        in: [
          BillingAccountOwnerModel.Space,
          BillingAccountOwnerModel.OrganizationUser,
          BillingAccountOwnerModel.SpaceUser,
        ],
      },
      ...(payload.spaceId ? { spaceId: payload.spaceId } : {}),
      ...(payload.userId ? { userId: payload.userId } : {}),
      deletedAt: null,
    },
    select: {
      id: true,
      ownerModel: true,
      organizationId: true,
      spaceId: true,
      userId: true,
    },
  });

  const disallowedIds: string[] = [];
  for (const account of accounts) {
    const allowed = await isBillingOwnerAllowed(account);
    if (!allowed) disallowedIds.push(account.id);
  }

  if (disallowedIds.length === 0) return;

  await db.billingResource.updateManyAndReturn({
    where: { billingAccountId: { in: disallowedIds }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
};
