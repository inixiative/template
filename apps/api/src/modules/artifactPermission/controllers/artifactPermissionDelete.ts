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
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { assertGrantableRole } from '#/modules/artifact/lib/assertGrantableRole';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';
import { artifactPermissionDeleteRoute } from '#/modules/artifactPermission/routes/artifactPermissionDelete';

export const artifactPermissionDeleteController = makeController(
  artifactPermissionDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permission = contextResource<'artifactPermission'>(c);
    const actor = artifactActorFromContext(c);
    await db.txn(async () => {
      const [locked] = await db.findForUpdate<Artifact>('Artifact', { id: permission.artifactId });
      if (!locked || locked.deletedAt) {
        throw makeError({ status: 404, message: 'Artifact not found' });
      }
      const verdicts = await checkArtifactAccess(actor, [locked.id], 'manage');
      assertGrantableRole(verdicts.get(locked.id), permission.role);
      await db.artifactPermission.update({
        where: { id: permission.id },
        data: { deletedAt: new Date() },
      });
    });
    return respond.noContent();
  },
);
