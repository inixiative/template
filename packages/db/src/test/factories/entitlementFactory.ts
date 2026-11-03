/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import type { EntitlementEntry } from '@inixiative/permissions';
import { db } from '@template/db/client';
import {
  type EntitlementTarget,
  toEntitlementRow,
} from '@template/db/entitlements/entitlementEntry';
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

// A test writes a `where` as a plain object; the row stores whatever it is given.
export type StoredEntry = Omit<EntitlementEntry, 'where'> & { where?: object | boolean };

/** Stores entries on a target as rows, as the writer would, without its grant check. */
export const storeEntitlements = (target: EntitlementTarget, entries: StoredEntry[]) =>
  entries.length
    ? db.entitlement.createManyAndReturn({
        data: entries.map((entry) => toEntitlementRow(entry as EntitlementEntry, target)),
      })
    : Promise.resolve([]);

export type EntitlementsOverride = { entitlements?: StoredEntry[] | null };
