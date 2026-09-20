/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { emitAppEvent } from '#/appEvents/emit';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceDeleteRoute } from '#/modules/space/routes/spaceDelete';

export const spaceDeleteController = makeController(spaceDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const space = getResource<'space'>(c);

  const deleted = await db.space.update({
    where: { id: space.id },
    data: { deletedAt: new Date() },
  });
  await emitAppEvent('space.deleted', { space: deleted });

  return respond.noContent();
});
