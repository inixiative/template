/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { FieldRegistry } from '@template/db/registries/fieldRegistry';

export const INTERNAL_FIELDS: FieldRegistry = {
  User: ['platformRole'],
  BillingAccount: ['externalCustomerId', 'externalSubscriptionId'],
};
