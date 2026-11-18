/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { db } from '@template/db/client';
import { fetchEntitlementAnchors } from '@template/db/entitlements/entitlementAnchors';
import {
  type EntitlementHolder,
  type EntitlementInput,
  toEntitlementCreateData,
} from '@template/db/entitlements/entitlementRow';
import { EntitlementResourceModel } from '@template/db/generated/client/enums';
import { registerFactory } from '@template/db/test/factory';

const entitlementFactory = registerFactory('Entitlement', {
  defaults: () => ({
    resource: EntitlementResourceModel.Organization,
    actions: ['read'],
  }),
});

export const buildEntitlement = entitlementFactory.build;
export const createEntitlement = entitlementFactory.create;

/** Stores rows on a holder, as the writer would, without its grant check. */
export const storeEntitlements = async (holder: EntitlementHolder, inputs: EntitlementInput[]) =>
  inputs.length
    ? db.entitlement.createManyAndReturn({
        data: toEntitlementCreateData(inputs, holder, await fetchEntitlementAnchors(inputs)),
      })
    : [];

export type EntitlementsOverride = { entitlements?: EntitlementInput[] | null };
