/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { artifactCopyRoute } from '#/modules/artifact/routes/artifactCopy';
import { copyArtifact } from '#/modules/artifact/services/copyArtifact';

export const artifactCopyController = makeController(artifactCopyRoute, async (c, respond) => {
  const body = c.req.valid('json');
  const source = contextResource<'artifact'>(c);
  const permix = c.get('permix');

  if (body.targetContainerArtifactId !== undefined) {
    const copy = await copyArtifact(permix, {
      source,
      targetContainerArtifactId: body.targetContainerArtifactId,
      name: body.name,
    });
    return respond.ok(copy);
  }

  const owner = body.ownerModel
    ? {
        ownerModel: body.ownerModel,
        userId: body.userId,
        organizationId: body.organizationId,
        spaceId: body.spaceId,
      }
    : (() => {
        const user = actingUser(c);
        if (!user) {
          throw makeError({
            status: 400,
            message: 'Provide targetContainerArtifactId or ownerModel when copying without a user',
          });
        }
        return { ownerModel: 'User' as const, userId: user.id };
      })();

  const copy = await copyArtifact(permix, { source, owner, name: body.name });
  return respond.ok(copy);
});
