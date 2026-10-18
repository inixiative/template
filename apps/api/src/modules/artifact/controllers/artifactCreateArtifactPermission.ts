/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { assertGrantableRole } from '#/modules/artifact/lib/assertGrantableRole';
import { artifactCreateArtifactPermissionRoute } from '#/modules/artifact/routes/artifactCreateArtifactPermission';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export const artifactCreateArtifactPermissionController = makeController(
  artifactCreateArtifactPermissionRoute,
  async (c, respond) => {
    const db = c.get('db');
    const artifact = getResource<'artifact'>(c);
    const body = c.req.valid('json');
    const verdicts = await checkArtifactAccess(
      artifactActorFromContext(c),
      [artifact.id],
      'manage',
    );
    assertGrantableRole(verdicts.get(artifact.id), body.role);
    const permission = await db.artifactPermission.create({
      data: { ...body, artifactId: artifact.id } as Prisma.ArtifactPermissionUncheckedCreateInput,
    });
    return respond.created(permission);
  },
);
