/**
 * @atlas
 * @kind controller
 * @partOf feature:featureFlag
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { featureFlagDeleteRoute } from '#/modules/featureFlag/routes/featureFlagDelete';

export const featureFlagDeleteController = makeController(featureFlagDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const flag = getResource<'featureFlag'>(c);
  await db.featureFlag.update({ where: { id: flag.id }, data: { deletedAt: new Date() } });
  return respond.noContent();
});
