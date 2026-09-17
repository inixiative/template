/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { FileVersionStatus } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const fileVersionFactory = createFactory('FileVersion', {
  defaults: () => ({
    version: 1,
    key: `${faker.string.uuid()}-${faker.system.fileName()}`,
    contentType: 'image/png',
    size: faker.number.int({ min: 1_000, max: 5_000_000 }),
    status: FileVersionStatus.active,
  }),
  dependencies: {
    file: { modelName: 'File', foreignKey: { id: 'fileId' }, required: false },
  },
});

export const buildFileVersion = fileVersionFactory.build;
export const createFileVersion = fileVersionFactory.create;
export const upsertFileVersion = fileVersionFactory.upsert;
