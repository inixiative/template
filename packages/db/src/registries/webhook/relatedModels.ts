/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { FlexibleRef } from '@template/db/registries/falsePolymorphism';

export const webhookRelatedModels: Record<string, FlexibleRef[]> = {
  User: [
    { model: 'CustomerRelationship', axis: 'customerModel', value: 'User' },
    { model: 'CustomerRelationship', axis: 'providerModel', value: 'User' },
  ],
  Organization: [
    { model: 'CustomerRelationship', axis: 'customerModel', value: 'Organization' },
    { model: 'CustomerRelationship', axis: 'providerModel', value: 'Organization' },
  ],
  Space: [
    { model: 'CustomerRelationship', axis: 'customerModel', value: 'Space' },
    { model: 'CustomerRelationship', axis: 'providerModel', value: 'Space' },
  ],
};
