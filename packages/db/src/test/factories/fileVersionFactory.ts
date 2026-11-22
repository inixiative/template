/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { FileVersionStatus } from '@template/db/generated/client/enums';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const fileVersionFactory = registerFactory('FileVersion', {
  defaults: () => ({
    version: nextFactorySequenceNumber(),
    key: `${nextFactorySequenceNumber()}-${faker.string.uuid()}-${faker.system.fileName()}`,
    contentType: 'image/png',
    size: faker.number.int({ min: 1_000, max: 5_000_000 }),
    status: FileVersionStatus.active,
  }),
  dependencies: {
    file: { modelName: 'File', foreignKey: { id: 'fileId' } },
  },
});

export const buildFileVersion = fileVersionFactory.build;
export const createFileVersion = fileVersionFactory.create;
export const upsertFileVersion = fileVersionFactory.upsert;
