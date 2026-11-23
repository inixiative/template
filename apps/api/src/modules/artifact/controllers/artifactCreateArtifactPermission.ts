/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import type { Prisma } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { assertGrantableRole } from '#/modules/artifact/lib/assertGrantableRole';
import { hydrateArtifact } from '#/modules/artifact/lib/checkArtifactPermission';
import { artifactCreateArtifactPermissionRoute } from '#/modules/artifact/routes/artifactCreateArtifactPermission';

export const artifactCreateArtifactPermissionController = makeController(
  artifactCreateArtifactPermissionRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = contextResource<'artifact'>(c);
    const body = c.req.valid('json');
    const permix = c.get('permix');
    const permission = await db.txn(async () => {
      const [locked] = await db.findForUpdate<Artifact>('Artifact', { id: artifact.id });
      if (!locked || locked.deletedAt) {
        throw makeError({ status: 404, message: 'Artifact not found' });
      }
      assertGrantableRole(permix, await hydrateArtifact(locked), body.role);
      return db.artifactPermission.create({
        data: { ...body, artifactId: locked.id } as Prisma.ArtifactPermissionUncheckedCreateInput,
      });
    });
    return respond.created(permission);
  },
);
