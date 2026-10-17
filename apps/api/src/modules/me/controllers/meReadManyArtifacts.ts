/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */

import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { listRootArtifacts } from '#/modules/artifact/services/listRootArtifacts';
import { readableArtifacts } from '#/modules/artifact/services/readableArtifacts';
import { meReadManyArtifactsRoute } from '#/modules/me/routes/meReadManyArtifacts';

export const meReadManyArtifactsController = makeController(
  meReadManyArtifactsRoute,
  async (c, respond) => {
    const roots = await listRootArtifacts({ ownerModel: 'User', userId: c.get('user')!.id });
    return respond.ok(await readableArtifacts(artifactActorFromContext(c), roots));
  },
);
