/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import type { Artifact } from '@template/db/generated/client/client';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { makeController } from '#/lib/utils/makeController';
import { artifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { assertGrantableRole } from '#/modules/artifact/lib/assertGrantableRole';
import { hydrateArtifact } from '#/modules/artifact/lib/checkArtifactPermission';
import { artifactPermissionUpdateRoute } from '#/modules/artifactPermission/routes/artifactPermissionUpdate';

export const artifactPermissionUpdateController = makeController(
  artifactPermissionUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permission = contextResource<'artifactPermission'>(c);
    const body = c.req.valid('json');
    const permix = c.get('permix');
    const artifact = await db.artifact.findUnique({ where: { id: permission.artifactId } });
    if (!artifact) {
      throw makeError({ status: 404, message: 'Artifact not found' });
    }
    const updated = await withOwnerLock(artifactOwner(artifact), 'containers', () =>
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
        assertGrantableRole(
          permix,
          await hydrateArtifact(locked),
          current.role,
          ...(body.role ? [body.role] : []),
        );
        return db.artifactPermission.update({
          where: { id: current.id },
          data: body,
        });
      }),
    );
    return respond.ok(updated);
  },
);
