/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { assertGrantableRole } from '#/modules/artifact/lib/assertGrantableRole';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';
import { artifactPermissionDeleteRoute } from '#/modules/artifactPermission/routes/artifactPermissionDelete';

export const artifactPermissionDeleteController = makeController(
  artifactPermissionDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permission = getResource<'artifactPermission'>(c);
    const verdicts = await checkArtifactAccess(
      artifactActorFromContext(c),
      [permission.artifactId],
      'manage',
    );
    assertGrantableRole(verdicts.get(permission.artifactId), permission.role);
    await db.artifactPermission.delete({ where: { id: permission.id } });
    return respond.noContent();
  },
);
