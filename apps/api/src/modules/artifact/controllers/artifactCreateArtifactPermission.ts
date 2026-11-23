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
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { assertGrantableRole } from '#/modules/artifact/lib/assertGrantableRole';
import { artifactCreateArtifactPermissionRoute } from '#/modules/artifact/routes/artifactCreateArtifactPermission';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export const artifactCreateArtifactPermissionController = makeController(
  artifactCreateArtifactPermissionRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = contextResource<'artifact'>(c);
    const body = c.req.valid('json');
    const actor = artifactActorFromContext(c);
    const permission = await db.txn(async () => {
      const [locked] = await db.findForUpdate<Artifact>('Artifact', { id: artifact.id });
      if (!locked || locked.deletedAt) {
        throw makeError({ status: 404, message: 'Artifact not found' });
      }
      const verdicts = await checkArtifactAccess(actor, [locked.id], 'manage');
      assertGrantableRole(verdicts.get(locked.id), body.role);
      return db.artifactPermission.create({
        data: { ...body, artifactId: locked.id } as Prisma.ArtifactPermissionUncheckedCreateInput,
      });
    });
    return respond.created(permission);
  },
);
