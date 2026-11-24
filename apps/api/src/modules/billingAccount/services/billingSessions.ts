/**
 * @atlas
 * @kind service
 * @partOf feature:billing
 * @uses infrastructure:prisma, infrastructure:billing, mutex, primitive:errors
 */
import { db } from '@template/db';
import type { BillingAccount } from '@template/db/generated/client/client';
import { BillingAccountOwnerModel } from '@template/db/generated/client/enums';
import {
  billingClientForProviderOrThrow,
  type CreatePortalSessionResult,
  type CreateSetupSessionResult,
} from '#/lib/billing';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { applyBillingAccountState } from '#/modules/billingAccount/services/applyBillingAccountState';
import {
  assertBillingOwnerAllowed,
  ownerLockKeyForBillingAccount,
} from '#/modules/billingAccount/services/billingGovernance';

const ensureExternalCustomerId = async (account: BillingAccount): Promise<string> => {
  if (account.externalCustomerId) return account.externalCustomerId;

  return withOwnerLock(ownerLockKeyForBillingAccount(account), 'billing', async () => {
    const current = await db.billingAccount.findFirstOrThrow({
      where: { id: account.id, deletedAt: null },
    });
    if (current.externalCustomerId) return current.externalCustomerId;

    const client = billingClientForProviderOrThrow(current.provider);
    const kind =
      current.ownerModel === BillingAccountOwnerModel.Organization ||
      current.ownerModel === BillingAccountOwnerModel.Space
        ? 'organization'
        : 'individual';

    const { externalCustomerId } = await client.ensureCustomer({
      accountId: current.id,
      billingEmail: current.billingEmail,
      name: current.name,
      kind,
    });

    await db.billingAccount.update({
      where: { id: current.id },
      data: { externalCustomerId },
    });

    return externalCustomerId;
  });
};

export const createBillingSetupSession = async (
  account: BillingAccount,
  input: {
    successUrl: string;
    returnUrl: string;
    mode: 'payAsYouGo' | 'subscription';
    planKey?: string;
  },
): Promise<CreateSetupSessionResult> => {
  await assertBillingOwnerAllowed(account);

  const externalCustomerId = await ensureExternalCustomerId(account);
  const client = billingClientForProviderOrThrow(account.provider);

  return client.createSetupSession({
    accountId: account.id,
    externalCustomerId,
    billingEmail: account.billingEmail,
    mode: input.mode,
    planKey: input.planKey,
    successUrl: input.successUrl,
    returnUrl: input.returnUrl,
  });
};

export const createBillingPortalSession = async (
  account: BillingAccount,
  returnUrl: string,
): Promise<CreatePortalSessionResult> => {
  if (!account.externalCustomerId) {
    throw makeError({
      status: 422,
      message: 'Complete payment setup before opening the billing portal',
    });
  }
  const client = billingClientForProviderOrThrow(account.provider);
  return client.createPortalSession({
    accountId: account.id,
    externalCustomerId: account.externalCustomerId,
    returnUrl,
  });
};

export const syncBillingAccount = async (account: BillingAccount): Promise<BillingAccount> => {
  if (!account.externalCustomerId) return account;
  const client = billingClientForProviderOrThrow(account.provider);
  const state = await client.fetchAccountState({
    accountId: account.id,
    externalCustomerId: account.externalCustomerId,
  });
  return applyBillingAccountState(account, state);
};
