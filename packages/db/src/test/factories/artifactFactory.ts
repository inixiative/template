/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { ArtifactType } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const artifactFactory = createFactory('Artifact', {
  defaults: () => ({
    kind: 'file',
    type: ArtifactType.object,
    name: faker.word.noun(),
  }),
  dependencies: {
    user: { modelName: 'User', foreignKey: { id: 'userId' }, required: false },
    organization: {
      modelName: 'Organization',
      foreignKey: { id: 'organizationId' },
      required: false,
    },
    space: { modelName: 'Space', foreignKey: { id: 'spaceId' }, required: false },
    integration: {
      modelName: 'Integration',
      foreignKey: { id: 'integrationId' },
      required: false,
    },
  },
});

export const buildArtifact = artifactFactory.build;
export const createArtifact = artifactFactory.create;
export const upsertArtifact = artifactFactory.upsert;
