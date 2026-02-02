import type { FlexibleRef } from '@template/db';

/**
 * Related Models
 *
 * Maps models to webhook targets via flexible references.
 * Can be a direct model name or a FalsePolymorphismRef.
 *
 * When a model changes, webhooks are sent to subscribers
 * who have a relationship via the referenced axis.
 */
export const webhookRelatedModels: Record<string, FlexibleRef[]> = {
  User: [
    { model: 'CustomerRef', axis: 'customerModel', value: 'User' },
  ],
  Organization: [
    { model: 'CustomerRef', axis: 'customerModel', value: 'Organization' },
  ],
  Space: [
    { model: 'CustomerRef', axis: 'customerModel', value: 'Space' },
    { model: 'CustomerRef', axis: 'providerModel', value: 'Space' },
  ],
};
