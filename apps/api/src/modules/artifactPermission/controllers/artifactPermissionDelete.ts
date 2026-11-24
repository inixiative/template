/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { check, rebacSchema } from '@template/permissions/rebac';
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
    await withLockedArtifactPermission(permission, async (current, hydrated) => {
      if (
        !check(
          permix,
          rebacSchema,
          'artifactPermission',
          { ...current, artifact: hydrated },
          'delete',
        )
      ) {
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
