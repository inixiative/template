/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { ArtifactType } from '@template/db/generated/client/enums';
import { registerFactory } from '@template/db/test/factory';

const artifactFactory = registerFactory('Artifact', {
  defaults: () => ({
    kind: 'file',
    type: ArtifactType.object,
    name: faker.word.noun(),
  }),
});

export const buildArtifact = artifactFactory.build;
export const createArtifact = artifactFactory.create;
export const upsertArtifact = artifactFactory.upsert;
