/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import type { Artifact } from '@template/db/generated/client/client';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { assertGrantableRole } from '#/modules/artifact/lib/assertGrantableRole';
import { hydrateArtifact } from '#/modules/artifact/lib/checkArtifactPermission';
import { artifactPermissionDeleteRoute } from '#/modules/artifactPermission/routes/artifactPermissionDelete';

export const artifactPermissionDeleteController = makeController(
  artifactPermissionDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permission = contextResource<'artifactPermission'>(c);
    const permix = c.get('permix');
    await db.txn(async () => {
      const [locked] = await db.findForUpdate<Artifact>('Artifact', { id: permission.artifactId });
      if (!locked || locked.deletedAt) {
        throw makeError({ status: 404, message: 'Artifact not found' });
      }
      const current = await db.artifactPermission.findUnique({ where: { id: permission.id } });
      if (!current || current.artifactId !== locked.id) {
        throw makeError({ status: 404, message: 'ArtifactPermission not found' });
      }
      assertGrantableRole(permix, await hydrateArtifact(locked), current.role);
      await db.artifactPermission.update({
        where: { id: current.id },
        data: { deletedAt: new Date() },
      });
    });
    return respond.noContent();
  },
);
