/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { FileOwnerModel } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const folderFactory = createFactory('Folder', {
  defaults: () => ({
    ownerModel: FileOwnerModel.User,
    path: '/',
    name: faker.word.noun(),
  }),
  dependencies: {
    user: { modelName: 'User', foreignKey: { id: 'userId' }, required: false },
    organization: { modelName: 'Organization', foreignKey: { id: 'organizationId' }, required: false },
    space: { modelName: 'Space', foreignKey: { id: 'spaceId' }, required: false },
    parent: { modelName: 'Folder', foreignKey: { id: 'parentId' }, required: false },
  },
});

export const buildFolder = folderFactory.build;
export const createFolder = folderFactory.create;
export const upsertFolder = folderFactory.upsert;
