/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { fetchRootArtifacts } from '#/modules/artifact/services/fetchRootArtifacts';
import { meReadManyArtifactsRoute } from '#/modules/me/routes/meReadManyArtifacts';

export const meReadManyArtifactsController = makeController(
  meReadManyArtifactsRoute,
  async (c, respond) => {
    const roots = await fetchRootArtifacts(c.get('permix'), {
      ownerModel: 'User',
      userId: actingUser(c)!.id,
    });
    return respond.ok(roots);
  },
);
