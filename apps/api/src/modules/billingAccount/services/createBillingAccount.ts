/**
 * @atlas
 * @kind service
 * @partOf feature:billing
 * @uses infrastructure:prisma, infrastructure:billing, mutex, primitive:errors
 */
import { db } from '@template/db';
import type { BillingAccount } from '@template/db/generated/client/client';
import {
  type BillingAccountOwnerModel,
  BillingAccountSharing,
  type BillingProvider,
} from '@template/db/generated/client/enums';
import { polymorphicAxis } from '@template/db/registries/falsePolymorphism';
import { defaultBillingClient } from '#/lib/billing';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import {
  type BillingOwnerRef,
  isBillingOwnerAllowed,
  ownerLockKeyForBillingAccount,
} from '#/modules/billingAccount/services/billingGovernance';

export type CreateBillingAccountInput = {
  owner: BillingOwnerRef;
  name: string;
  billingEmail: string;
  isDefault?: boolean;
  sharing?: BillingAccountSharing;
  provider?: BillingProvider;
};

export const ownerWhereForBillingAccount = (
  owner: BillingOwnerRef,
): {
  ownerModel: BillingAccountOwnerModel;
  userId?: string;
  organizationId?: string;
  spaceId?: string;
} => {
  const fkColumns = polymorphicAxis('BillingAccount', 'ownerModel').fkMap[owner.ownerModel] ?? [];
  const where: Record<string, string> = { ownerModel: owner.ownerModel };
  for (const column of fkColumns) {
    const value = (owner as Record<string, unknown>)[column];
    if (typeof value === 'string' && value) where[column] = value;
  }
  return where as {
    ownerModel: BillingAccountOwnerModel;
    userId?: string;
    organizationId?: string;
    spaceId?: string;
  };
};

export const createBillingAccountRecord = async (
  input: CreateBillingAccountInput,
): Promise<BillingAccount> => {
  const allowed = await isBillingOwnerAllowed(input.owner);
  if (!allowed) {
    throw makeError({
      status: 403,
      message: `${input.owner.ownerModel} billing is not enabled by parent settings`,
    });
  }

  const lockKey = ownerLockKeyForBillingAccount(input.owner);
  const ownerWhere = ownerWhereForBillingAccount(input.owner);

  return withOwnerLock(lockKey, 'billing', () =>
    db.txn(async () => {
      const existingCount = await db.billingAccount.count({
        where: { ...ownerWhere, deletedAt: null },
      });
      const shouldBeDefault = existingCount === 0 || input.isDefault === true;

      if (shouldBeDefault && existingCount > 0) {
        await db.billingAccount.updateManyAndReturn({
          where: { ...ownerWhere, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }

      return db.billingAccount.create({
        data: {
          ...ownerWhere,
          name: input.name,
          billingEmail: input.billingEmail.trim().toLowerCase(),
          isDefault: shouldBeDefault,
          sharing: input.sharing ?? BillingAccountSharing.inherit,
          provider: input.provider ?? defaultBillingClient.provider,
        },
      });
    }),
  );
};
