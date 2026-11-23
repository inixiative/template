/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses infrastructure:billing, infrastructure:prisma
 */
import { db } from '@template/db';
import type { BillingProvider } from '@template/db/generated/client/enums';
import { log } from '@template/shared/logger';
import type { JobHandler } from '#/jobs/types';
import { billingClientForProviderOrThrow } from '#/lib/billing';

export type CancelBillingAccountPayload = {
  billingAccountId: string;
  provider: BillingProvider;
  externalCustomerId: string;
  externalSubscriptionId: string | null;
  releaseCustomer?: boolean;
};

export const cancelBillingAccount: JobHandler<CancelBillingAccountPayload> = async (
  _ctx,
  payload,
) => {
  const client = billingClientForProviderOrThrow(payload.provider);
  await client.cancelAccount({
    accountId: payload.billingAccountId,
    externalCustomerId: payload.externalCustomerId,
    externalSubscriptionId: payload.externalSubscriptionId,
    immediate: true,
    releaseCustomer: payload.releaseCustomer ?? true,
  });

  await db.withDeleted(() =>
    db.billingAccount.updateManyAndReturn({
      where: { id: payload.billingAccountId },
      data: { lastSyncedAt: new Date() },
    }),
  );
  log.info(`Canceled external billing account ${payload.billingAccountId} on ${payload.provider}`);
};
