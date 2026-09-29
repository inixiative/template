/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { WebhookModel } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const integrationRecordFactory = createFactory('IntegrationRecord', {
  defaults: () => ({
    model: WebhookModel.CustomerRef,
  }),
  dependencies: {
    integration: {
      modelName: 'Integration',
      foreignKey: { id: 'integrationId' },
      required: true,
    },
    customerRef: {
      modelName: 'CustomerRef',
      foreignKey: { id: 'customerRefId' },
      required: false,
    },
  },
});

export const buildIntegrationRecord = integrationRecordFactory.build;
export const createIntegrationRecord = integrationRecordFactory.create;
