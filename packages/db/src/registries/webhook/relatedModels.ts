/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { FlexibleRef } from '@template/db/registries/falsePolymorphism';

export const webhookRelatedModels: Record<string, FlexibleRef[]> = {
  User: [{ model: 'CustomerRef', axis: 'customerModel', value: 'User' }],
  Organization: [{ model: 'CustomerRef', axis: 'customerModel', value: 'Organization' }],
  Space: [
    { model: 'CustomerRef', axis: 'customerModel', value: 'Space' },
    { model: 'CustomerRef', axis: 'providerModel', value: 'Space' },
  ],
};
