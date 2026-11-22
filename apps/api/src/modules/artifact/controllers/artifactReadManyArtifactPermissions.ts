/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactReadManyArtifactPermissionsRoute } from '#/modules/artifact/routes/artifactReadManyArtifactPermissions';

export const artifactReadManyArtifactPermissionsController = makeController(
  artifactReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = contextResource<'artifact'>(c);
    const permissions = await db.artifactPermission.findMany({
      where: { artifactId: artifact.id },
    });
    return respond.ok(permissions);
  },
);
