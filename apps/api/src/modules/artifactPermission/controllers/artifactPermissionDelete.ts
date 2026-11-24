/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import type { Artifact } from '@template/db/generated/client/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { makeController } from '#/lib/utils/makeController';
import { artifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { hydrateArtifact } from '#/modules/artifact/lib/checkArtifactPermission';
import { artifactPermissionDeleteRoute } from '#/modules/artifactPermission/routes/artifactPermissionDelete';

export const artifactPermissionDeleteController = makeController(
  artifactPermissionDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permission = contextResource<'artifactPermission'>(c);
    const permix = c.get('permix');
    const artifact = await db.artifact.findUnique({ where: { id: permission.artifactId } });
    if (!artifact) {
      throw makeError({ status: 404, message: 'Artifact not found' });
    }
    await withOwnerLock(artifactOwner(artifact), 'containers', () =>
      db.txn(async () => {
        const [locked] = await db.findForUpdate<Artifact>('Artifact', {
          id: permission.artifactId,
        });
        if (!locked || locked.deletedAt) {
          throw makeError({ status: 404, message: 'Artifact not found' });
        }
        const current = await db.artifactPermission.findUnique({ where: { id: permission.id } });
        if (!current || current.artifactId !== locked.id) {
          throw makeError({ status: 404, message: 'ArtifactPermission not found' });
        }
        const hydrated = await hydrateArtifact(locked);
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
      }),
    );
    return respond.noContent();
  },
);
