/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { hydrate } from '@template/db';
import { check } from '@template/permissions/rebac';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { withLockedArtifactPermission } from '#/modules/artifactPermission/lib/withLockedArtifactPermission';
import { artifactPermissionDeleteRoute } from '#/modules/artifactPermission/routes/artifactPermissionDelete';

export const artifactPermissionDeleteController = makeController(
  artifactPermissionDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permission = contextResource<'artifactPermission'>(c);
    const permix = c.get('permix');
    await withLockedArtifactPermission(permission, async (current, hydratedArtifact) => {
      const hydratedPermission = {
        ...(await hydrate('artifactPermission', current)),
        artifact: hydratedArtifact,
      };
      if (!check(permix, 'artifactPermission', hydratedPermission, 'delete')) {
        throw makeError({ status: 403, message: 'Forbidden' });
      }
      await db.artifactPermission.update({
        where: { id: current.id },
        data: { deletedAt: new Date() },
      });
    });
    return respond.noContent();
  },
);
