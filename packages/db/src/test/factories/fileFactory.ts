/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { FileOwnerModel } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const fileFactory = createFactory('File', {
  defaults: () => ({
    ownerModel: FileOwnerModel.User,
    path: '/',
    filename: faker.system.fileName(),
  }),
  dependencies: {
    user: { modelName: 'User', foreignKey: { id: 'userId' }, required: false },
    organization: { modelName: 'Organization', foreignKey: { id: 'organizationId' }, required: false },
    space: { modelName: 'Space', foreignKey: { id: 'spaceId' }, required: false },
    folder: { modelName: 'Folder', foreignKey: { id: 'folderId' }, required: false },
  },
});

export const buildFile = fileFactory.build;
export const createFile = fileFactory.create;
export const upsertFile = fileFactory.upsert;
