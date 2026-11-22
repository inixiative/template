/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const projectIntegrationFactory = registerFactory('ProjectIntegration', {
  defaults: () => ({}),
  dependencies: {
    project: {
      modelName: 'Project',
      foreignKey: { id: 'projectId' },
      required: true,
    },
    integration: {
      modelName: 'Integration',
      foreignKey: { id: 'integrationId' },
      required: true,
    },
  },
});

export const buildProjectIntegration = projectIntegrationFactory.build;
export const createProjectIntegration = projectIntegrationFactory.create;
