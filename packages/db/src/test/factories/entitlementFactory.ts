/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { db } from '@template/db/client';
import { loadEntitlementAnchors } from '@template/db/entitlements/entitlementAnchors';
import {
  type EntitlementHolder,
  type EntitlementInput,
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

/** Stores rows on a holder, as the writer would, without its grant check. */
export const storeEntitlements = async (holder: EntitlementHolder, inputs: EntitlementInput[]) =>
  inputs.length
    ? db.entitlement.createManyAndReturn({
        data: toEntitlementCreateData(inputs, holder, await loadEntitlementAnchors(inputs)),
      })
    : [];

export type EntitlementsOverride = { entitlements?: EntitlementInput[] | null };
