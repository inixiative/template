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
import { artifactPermissionUpdateRoute } from '#/modules/artifactPermission/routes/artifactPermissionUpdate';

export const artifactPermissionUpdateController = makeController(
  artifactPermissionUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permission = getResource<'artifactPermission'>(c);
    const body = c.req.valid('json');
    if (body.role) {
      const verdicts = await checkArtifactAccess(
        artifactActorFromContext(c),
        [permission.artifactId],
        'manage',
      );
      assertGrantableRole(verdicts.get(permission.artifactId), body.role);
    }
    const updated = await db.artifactPermission.update({
      where: { id: permission.id },
      data: body,
    });
    return respond.ok(updated);
  },
);
