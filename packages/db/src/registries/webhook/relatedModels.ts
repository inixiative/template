/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { FalsePolymorphismRef } from '@template/db/registries/falsePolymorphism';

export const webhookRelatedModels: Record<string, FalsePolymorphismRef[]> = {
  User: [
    { model: 'CustomerRef', axis: 'customerModel', value: 'User' },
    { model: 'CustomerRef', axis: 'providerModel', value: 'User' },
  ],
  Organization: [
    { model: 'CustomerRef', axis: 'customerModel', value: 'Organization' },
    { model: 'CustomerRef', axis: 'providerModel', value: 'Organization' },
  ],
  Space: [
    { model: 'CustomerRef', axis: 'customerModel', value: 'Space' },
    { model: 'CustomerRef', axis: 'providerModel', value: 'Space' },
  ],
};
