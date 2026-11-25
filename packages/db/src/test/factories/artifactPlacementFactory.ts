/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const artifactPlacementFactory = registerFactory('ArtifactPlacement', {
  defaults: () => ({}),
  dependencies: {
    artifact: { modelName: 'Artifact', foreignKey: { id: 'artifactId' } },
  },
});

export const buildArtifactPlacement = artifactPlacementFactory.build;
export const createArtifactPlacement = artifactPlacementFactory.create;
