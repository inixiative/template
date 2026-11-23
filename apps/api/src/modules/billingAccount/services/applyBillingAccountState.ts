/**
 * @atlas
 * @kind service
 * @partOf feature:billing
 * @uses infrastructure:prisma, infrastructure:billing, mutex, primitive:appEvents
 */
import { db } from '@template/db';
import type { BillingAccount } from '@template/db/generated/client/client';
import { log } from '@template/shared/logger';
import { emitAppEvent } from '#/appEvents/emit';
import type { NormalizedAccountState } from '#/lib/billing';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { ownerLockKeyForBillingAccount } from '#/modules/billingAccount/services/billingGovernance';

export type ApplyBillingAccountStateOptions = {
  resolveState?: (current: BillingAccount) => Promise<NormalizedAccountState>;
};

export const applyBillingAccountState = async (
  account: BillingAccount,
  state: NormalizedAccountState,
  options?: ApplyBillingAccountStateOptions,
): Promise<BillingAccount> => {
  const lockKey = ownerLockKeyForBillingAccount(account);

  return withOwnerLock(lockKey, 'billing', async () => {
    const preRead = await db.billingAccount.findFirst({
      where: { id: account.id, deletedAt: null },
    });
    if (!preRead) return account;

    const effectiveState = options?.resolveState ? await options.resolveState(preRead) : state;

    if (
      preRead.externalCustomerId &&
      effectiveState.externalCustomerId &&
      preRead.externalCustomerId !== effectiveState.externalCustomerId
    ) {
      throw makeError({
        status: 409,
        message: 'Billing webhook externalCustomerId does not match BillingAccount',
      });
    }

    if (effectiveState.duplicateSubscriptionIds?.length) {
      log.warn(
        {
          billingAccountId: preRead.id,
          primarySubscriptionId: effectiveState.externalSubscriptionId,
          duplicateSubscriptionIds: effectiveState.duplicateSubscriptionIds,
        },
        'Multiple active subscriptions detected on BillingAccount',
      );
    }

    return db.txn(async () => {
      const current = await db.billingAccount.findFirst({
        where: { id: account.id, deletedAt: null },
      });
      if (!current) return account;

      const paymentMethodPatch =
        effectiveState.paymentMethod === undefined
          ? {}
          : effectiveState.paymentMethod === null
            ? {
                paymentMethodType: null,
                paymentMethodBrand: null,
                paymentMethodLast4: null,
                paymentMethodExpMonth: null,
                paymentMethodExpYear: null,
              }
            : {
                paymentMethodType: effectiveState.paymentMethod.type,
                paymentMethodBrand: effectiveState.paymentMethod.brand,
                paymentMethodLast4: effectiveState.paymentMethod.last4,
                paymentMethodExpMonth: effectiveState.paymentMethod.expMonth,
                paymentMethodExpYear: effectiveState.paymentMethod.expYear,
              };

      const updated = await db.billingAccount.update({
        where: { id: current.id },
        data: {
          externalCustomerId: effectiveState.externalCustomerId,
          externalSubscriptionId: effectiveState.externalSubscriptionId,
          status: effectiveState.status,
          currentPeriodStart: effectiveState.currentPeriodStart,
          currentPeriodEnd: effectiveState.currentPeriodEnd,
          cancelAtPeriodEnd: effectiveState.cancelAtPeriodEnd,
          ...paymentMethodPatch,
          lastSyncedAt: new Date(),
        },
      });

      if (current.status !== updated.status) {
        const previousStatus = current.status;
        db.onCommit(async () => {
          await emitAppEvent('billingAccount.statusChanged', {
            billingAccountId: updated.id,
            ownerModel: updated.ownerModel,
            userId: updated.userId,
            organizationId: updated.organizationId,
            spaceId: updated.spaceId,
            previousStatus,
            status: updated.status,
          });
        });
      }

      return updated;
    });
  });
};
