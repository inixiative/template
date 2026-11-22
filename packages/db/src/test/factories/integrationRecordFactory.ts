/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const integrationRecordFactory = registerFactory('IntegrationRecord', {
  defaults: () => ({}),
  dependencies: {
    integration: {
      modelName: 'Integration',
      foreignKey: { id: 'integrationId' },
      required: true,
    },
    customerRelationship: {
      modelName: 'CustomerRelationship',
      foreignKey: { id: 'recordCustomerRelationshipId' },
      required: false,
    },
    artifact: {
      modelName: 'Artifact',
      foreignKey: { id: 'recordArtifactId' },
      required: false,
    },
  },
});

export const buildIntegrationRecord = integrationRecordFactory.build;
export const createIntegrationRecord = integrationRecordFactory.create;
