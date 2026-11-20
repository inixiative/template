/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const projectIntegrationResourceFactory = registerFactory('ProjectIntegrationResource', {
  defaults: () => ({}),
});

export const buildProjectIntegrationResource = projectIntegrationResourceFactory.build;
export const createProjectIntegrationResource = projectIntegrationResourceFactory.create;
