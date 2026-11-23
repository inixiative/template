/**
 * @atlas
 * @kind service
 * @partOf feature:billing
 * @uses infrastructure:prisma, primitive:authz, mutex, primitive:errors
 */
import { db, type HydratedRecord, hydrate } from '@template/db';
import type { BillingAccount, BillingResource } from '@template/db/generated/client/client';
import type { BillingResourceTargetModel } from '@template/db/generated/client/enums';
import { polymorphicAxis } from '@template/db/registries/falsePolymorphism';
import { check, rebacSchema } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import type { AppEnv } from '#/types/appEnv';

export type CreateBillingResourceInput = {
  billingAccountId: string;
  resourceModel: BillingResourceTargetModel;
  resourceOrganizationId?: string;
  resourceSpaceId?: string;
  resourceUserId?: string;
  resourceProjectId?: string;
  resourceProjectIntegrationId?: string;
  replaceExisting?: boolean;
};

const targetWhereFromInput = (input: CreateBillingResourceInput): Record<string, string> => {
  const fkColumns =
    polymorphicAxis('BillingResource', 'resourceModel').fkMap[input.resourceModel] ?? [];
  const where: Record<string, string> = { resourceModel: input.resourceModel };
  for (const column of fkColumns) {
    const value = (input as Record<string, unknown>)[column];
    if (typeof value !== 'string' || !value) {
      throw makeError({
        status: 422,
        message: `${input.resourceModel} target requires ${column}`,
      });
    }
    where[column] = value;
  }
  return where;
};

export const createBillingResourceRecord = async (
  c: Context<AppEnv>,
  input: CreateBillingResourceInput,
): Promise<BillingResource> => {
  const targetWhere = targetWhereFromInput(input);
  const pseudo = await hydrate('billingResource', {
    id: '',
    billingAccountId: input.billingAccountId,
    ...targetWhere,
  } as unknown as HydratedRecord);

  const permix = c.get('permix');
  if (!check(permix, rebacSchema, 'billingResource', pseudo, 'create')) {
    throw makeError({ status: 403, message: 'Access denied' });
  }

  const lockId = Object.values(targetWhere).join(':');
  return withOwnerLock({ ownerModel: 'BillingResource', ownerId: lockId }, 'billing', () =>
    db.txn(async () => {
      const [account] = await db.findForUpdate<BillingAccount>('BillingAccount', {
        id: input.billingAccountId,
      });
      if (!account || account.deletedAt !== null) {
        throw makeError({ status: 404, message: 'Billing account not found' });
      }

      const existing = await db.billingResource.findFirst({
        where: { ...targetWhere, deletedAt: null },
      });

      if (existing) {
        if (input.replaceExisting === false) {
          throw makeError({
            status: 409,
            message: 'Target already has an active billing resource binding',
          });
        }
        const hydratedExisting = await hydrate(
          'billingResource',
          existing as unknown as HydratedRecord,
        );
        if (!check(permix, rebacSchema, 'billingResource', hydratedExisting, 'delete')) {
          throw makeError({ status: 403, message: 'Access denied' });
        }
        await db.billingResource.update({
          where: { id: existing.id },
          data: { deletedAt: new Date() },
        });
      }

      return db.billingResource.create({
        data: {
          billingAccountId: input.billingAccountId,
          resourceModel: input.resourceModel,
          resourceOrganizationId: targetWhere.resourceOrganizationId ?? null,
          resourceSpaceId: targetWhere.resourceSpaceId ?? null,
          resourceUserId: targetWhere.resourceUserId ?? null,
          resourceProjectId: targetWhere.resourceProjectId ?? null,
          resourceProjectIntegrationId: targetWhere.resourceProjectIntegrationId ?? null,
        },
      });
    }),
  );
};
