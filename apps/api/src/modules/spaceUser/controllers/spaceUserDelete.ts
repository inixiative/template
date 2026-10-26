/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { db, hydrate } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserDeleteRoute } from '#/modules/spaceUser/routes/spaceUserDelete';

export const spaceUserDeleteController = makeController(
  spaceUserDeleteRoute,
  async (c, respond) => {
    const spaceUser = getResource<'spaceUser'>(c);
    const permix = c.get('permix');

    const hydrated = await hydrate('spaceUser', spaceUser);
    const canLeave = check(permix, rebacSchema, 'spaceUser', hydrated, 'leave');
    const canAssign = check(permix, rebacSchema, 'spaceUser', hydrated, 'assign');
    if (!canLeave && !canAssign)
      throw makeError({ status: 403, message: 'Cannot remove this user' });

    await db.spaceUser.delete({ where: { id: spaceUser.id } });

    return respond.noContent();
  },
);
