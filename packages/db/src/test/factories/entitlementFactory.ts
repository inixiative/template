/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { db } from '@template/db/client';
import {
  type EntitlementInput,
  type EntitlementTarget,
  toEntitlementCreateData,
} from '@template/db/entitlements/entitlementRow';
import { EntitlementResourceModel } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const entitlementFactory = createFactory('Entitlement', {
  defaults: () => ({
    resource: EntitlementResourceModel.Organization,
    actions: ['read'],
  }),
});

export const buildEntitlement = entitlementFactory.build;
export const createEntitlement = entitlementFactory.create;

/** Stores rows on a target, as the writer would, without its grant check. */
export const storeEntitlements = (target: EntitlementTarget, inputs: EntitlementInput[]) =>
  inputs.length
    ? db.entitlement.createManyAndReturn({
        data: inputs.map((input) => toEntitlementCreateData(input, target)),
      })
    : Promise.resolve([]);

export type EntitlementsOverride = { entitlements?: EntitlementInput[] | null };
