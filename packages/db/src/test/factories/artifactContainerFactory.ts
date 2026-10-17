/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { createFactory } from '@template/db/test/factory';

const artifactContainerFactory = createFactory('ArtifactContainer', {
  defaults: () => ({}),
  dependencies: {
    containerArtifact: {
      modelName: 'Artifact',
      foreignKey: { id: 'containerArtifactId' },
    },
    artifact: { modelName: 'Artifact', foreignKey: { id: 'artifactId' } },
  },
});

export const buildArtifactContainer = artifactContainerFactory.build;
export const createArtifactContainer = artifactContainerFactory.create;
