/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const projectIntegrationResourceFactory = registerFactory('ProjectIntegrationResource', {
  defaults: () => ({}),
  dependencies: {
    project: {
      modelName: 'Project',
      foreignKey: { id: 'projectId' },
      required: true,
    },
    integrationResource: {
      modelName: 'IntegrationResource',
      foreignKey: { id: 'integrationResourceId' },
      required: true,
    },
  },
});

export const buildProjectIntegrationResource = projectIntegrationResourceFactory.build;
export const createProjectIntegrationResource = projectIntegrationResourceFactory.create;
