/**
 * @atlas
 * @kind service
 * @partOf feature:billing
 * @uses infrastructure:prisma, infrastructure:billing, mutex, primitive:errors
 */
import { db } from '@template/db';
import type { BillingAccount } from '@template/db/generated/client/client';
import type { BillingAccountSharing } from '@template/db/generated/client/enums';
import { billingClientForProviderOrThrow } from '#/lib/billing';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { ownerLockKeyForBillingAccount } from '#/modules/billingAccount/services/billingGovernance';
import { ownerWhereForBillingAccount } from '#/modules/billingAccount/services/createBillingAccount';

export type UpdateBillingAccountInput = {
  account: BillingAccount;
  name?: string;
  billingEmail?: string;
  isDefault?: boolean;
  sharing?: BillingAccountSharing;
};

export const updateBillingAccountRecord = async (
  input: UpdateBillingAccountInput,
): Promise<BillingAccount> => {
  const { account } = input;
  const normalizedEmail = input.billingEmail?.trim().toLowerCase();

  const lockKey = ownerLockKeyForBillingAccount(account);
  const ownerWhere = ownerWhereForBillingAccount(account);

  return withOwnerLock(lockKey, 'billing', async () => {
    const preRead = await db.billingAccount.findFirst({
      where: { id: account.id, deletedAt: null },
    });
    if (!preRead) {
      throw makeError({ status: 404, message: 'Billing account not found' });
    }
    if (input.isDefault === false && preRead.isDefault) {
      throw makeError({
        status: 422,
        message: 'Cannot unset the default billing account directly; promote another account first',
      });
    }

    if (preRead.externalCustomerId && (input.name !== undefined || normalizedEmail !== undefined)) {
      const client = billingClientForProviderOrThrow(preRead.provider);
      await client.updateCustomer({
        accountId: preRead.id,
        externalCustomerId: preRead.externalCustomerId,
        name: input.name,
        billingEmail: normalizedEmail,
      });
    }

    return db.txn(async () => {
      const current = await db.billingAccount.findFirst({
        where: { id: account.id, deletedAt: null },
      });
      if (!current) {
        throw makeError({ status: 404, message: 'Billing account not found' });
      }
      if (input.isDefault === false && current.isDefault) {
        throw makeError({
          status: 422,
          message:
            'Cannot unset the default billing account directly; promote another account first',
        });
      }

      if (input.isDefault === true && !current.isDefault) {
        await db.billingAccount.updateManyAndReturn({
          where: { ...ownerWhere, isDefault: true, deletedAt: null, id: { not: current.id } },
          data: { isDefault: false },
        });
      }

      return db.billingAccount.update({
        where: { id: current.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(normalizedEmail !== undefined ? { billingEmail: normalizedEmail } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          ...(input.sharing !== undefined ? { sharing: input.sharing } : {}),
        },
      });
    });
  });
};
