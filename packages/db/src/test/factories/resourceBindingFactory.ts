/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { createFactory } from '@template/db/test/factory';

const resourceBindingFactory = createFactory('ResourceBinding', {
  defaults: () => ({
    bindingType: 'logo',
  }),
  dependencies: {
    artifact: { modelName: 'Artifact', foreignKey: { id: 'artifactId' }, required: false },
    organization: {
      modelName: 'Organization',
      foreignKey: { id: 'organizationId' },
      required: false,
    },
    space: { modelName: 'Space', foreignKey: { id: 'spaceId' }, required: false },
    user: { modelName: 'User', foreignKey: { id: 'userId' }, required: false },
    customerRef: { modelName: 'CustomerRef', foreignKey: { id: 'customerRefId' }, required: false },
  },
});

export const buildResourceBinding = resourceBindingFactory.build;
export const createResourceBinding = resourceBindingFactory.create;
export const upsertResourceBinding = resourceBindingFactory.upsert;
