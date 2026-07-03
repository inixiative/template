/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  ResourceBindingResourceModel,
  ResourceBindingSourceModel,
} from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const resourceBindingFactory = createFactory('ResourceBinding', {
  defaults: () => ({
    sourceModel: ResourceBindingSourceModel.File,
    resourceModel: ResourceBindingResourceModel.Organization,
    bindingType: 'logo',
  }),
  dependencies: {
    file: { modelName: 'File', foreignKey: { id: 'fileId' }, required: false },
    organization: { modelName: 'Organization', foreignKey: { id: 'organizationId' }, required: false },
    space: { modelName: 'Space', foreignKey: { id: 'spaceId' }, required: false },
    user: { modelName: 'User', foreignKey: { id: 'userId' }, required: false },
    customerRef: { modelName: 'CustomerRef', foreignKey: { id: 'customerRefId' }, required: false },
  },
});

export const buildResourceBinding = resourceBindingFactory.build;
export const createResourceBinding = resourceBindingFactory.create;
export const upsertResourceBinding = resourceBindingFactory.upsert;
