/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { db, includeTargetEntitlements, Prisma } from '@template/db';
import { contextResource } from '#/lib/context/contextResource';
import { assertTransition } from '#/lib/permissions/assertTransition';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserUpdateRoute } from '#/modules/spaceUser/routes/spaceUserUpdate';

export const spaceUserUpdateController = makeController(
  spaceUserUpdateRoute,
  async (c, respond) => {
    const spaceUser = contextResource<'spaceUser'>(c);
    const body = c.req.valid('json');
    const permix = c.get('permix');

    await assertTransition(permix, 'spaceUser', 'changeRole', spaceUser, {
      role: body.role ?? spaceUser.role,
    });

    const updated = await db.spaceUser.update({
      where: { id: spaceUser.id },
      include: includeTargetEntitlements('SpaceUser'),
      data: body,
    });

    return respond.ok(updated);
  },
);
