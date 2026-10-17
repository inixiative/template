/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { createFactory } from '@template/db/test/factory';

const fileFactory = createFactory('File', {
  defaults: () => ({}),
  dependencies: {
    artifact: { modelName: 'Artifact', foreignKey: { id: 'artifactId' } },
  },
});

export const buildFile = fileFactory.build;
export const createFile = fileFactory.create;
export const upsertFile = fileFactory.upsert;
