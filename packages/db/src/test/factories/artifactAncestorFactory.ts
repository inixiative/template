/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const artifactAncestorFactory = registerFactory('ArtifactAncestor', {
  defaults: () => ({
    inherits: true,
    depth: 1,
  }),
  dependencies: {
    ancestorArtifact: {
      modelName: 'Artifact',
      foreignKey: { id: 'ancestorArtifactId' },
    },
    artifact: { modelName: 'Artifact', foreignKey: { id: 'artifactId' } },
  },
});

export const buildArtifactAncestor = artifactAncestorFactory.build;
export const createArtifactAncestor = artifactAncestorFactory.create;
