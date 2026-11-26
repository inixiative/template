/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import type { Prisma } from '@template/db';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactCreateArtifactPermissionRoute } from '#/modules/artifact/routes/artifactCreateArtifactPermission';
import { withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import { validateArtifactPermissionGrant } from '#/modules/artifact/validations/validateArtifactPermissionGrant';
import { validateNotRootArtifact } from '#/modules/artifact/validations/validateNotRootArtifact';

export const artifactCreateArtifactPermissionController = makeController(
  artifactCreateArtifactPermissionRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = contextResource<'artifact'>(c);
    validateNotRootArtifact(artifact, 'Permissions cannot be granted directly on a root container');
    const body = c.req.valid('json');
    const permix = c.get('permix');
    const permission = await withLockedArtifacts([artifact], async (locked) => {
      const target = locked.get(artifact.id)!;
      await validateArtifactPermissionGrant(permix, target, body.role);
      return db.artifactPermission.create({
        data: { ...body, artifactId: target.id } as Prisma.ArtifactPermissionUncheckedCreateInput,
      });
    });
    return respond.created(permission);
  },
);
