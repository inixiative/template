/**
 * @atlas
 * @kind service
 * @partOf feature:billing
 * @uses infrastructure:prisma, mutex, primitive:errors
 */
import { db } from '@template/db';
import type { BillingAccount } from '@template/db/generated/client/client';
import { BillingAccountStatus } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { ownerLockKeyForBillingAccount } from '#/modules/billingAccount/services/billingGovernance';
import { ownerWhereForBillingAccount } from '#/modules/billingAccount/services/createBillingAccount';

export const deleteBillingAccountRecord = async (account: BillingAccount): Promise<void> => {
  const lockKey = ownerLockKeyForBillingAccount(account);
  const ownerWhere = ownerWhereForBillingAccount(account);

  await withOwnerLock(lockKey, 'billing', () =>
    db.txn(async () => {
      const [current] = await db.findForUpdate<BillingAccount>('BillingAccount', {
        id: account.id,
      });
      if (!current || current.deletedAt !== null) {
        throw makeError({ status: 404, message: 'Billing account not found' });
      }

      if (current.isDefault) {
        const siblingCount = await db.billingAccount.count({
          where: { ...ownerWhere, deletedAt: null, id: { not: current.id } },
        });
        if (siblingCount > 0) {
          throw makeError({
            status: 422,
            message:
              'Cannot delete the default billing account while other accounts exist; promote another default first',
          });
        }
      }

      await db.billingAccount.update({
        where: { id: current.id },
        data: {
          deletedAt: new Date(),
          isDefault: false,
          status: BillingAccountStatus.canceled,
        },
      });
    }),
  );
};
