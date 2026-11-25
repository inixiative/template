/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const artifactEffectivePermissionFactory = registerFactory('ArtifactEffectivePermission', {
  defaults: () => ({}),
  dependencies: {
    artifact: { modelName: 'Artifact', foreignKey: { id: 'artifactId' } },
    artifactPermission: {
      modelName: 'ArtifactPermission',
      foreignKey: { id: 'artifactPermissionId' },
    },
  },
});

export const buildArtifactEffectivePermission = artifactEffectivePermissionFactory.build;
export const createArtifactEffectivePermission = artifactEffectivePermissionFactory.create;
