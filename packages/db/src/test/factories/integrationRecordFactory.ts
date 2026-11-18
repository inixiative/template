/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { createFactory } from '@template/db/test/factory';

const integrationRecordFactory = createFactory('IntegrationRecord', {
  defaults: () => ({}),
  dependencies: {
    integration: {
      modelName: 'Integration',
      foreignKey: { id: 'integrationId' },
      required: true,
    },
    customerRelationship: {
      modelName: 'CustomerRelationship',
      foreignKey: { id: 'customerRelationshipId' },
      required: false,
    },
  },
});

export const buildIntegrationRecord = integrationRecordFactory.build;
export const createIntegrationRecord = integrationRecordFactory.create;
