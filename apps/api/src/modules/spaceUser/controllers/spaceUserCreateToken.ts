/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */
import { hydrate } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { spaceUserCreateTokenRoute } from '#/modules/spaceUser/routes/spaceUserCreateToken';

export const spaceUserCreateTokenController = makeController(
  spaceUserCreateTokenRoute,
  async (c, respond) => {
    const spaceUser = getResource<'spaceUser'>(c);
    const body = c.req.valid('json');

    const ownSeat = check(
      c.get('permix'),
      rebacSchema,
      'spaceUser',
      await hydrate('spaceUser', spaceUser),
      'leave',
    );
    if (!ownSeat)
      throw makeError({ status: 403, message: 'Only the seat itself mints its tokens' });

    const token = await createToken(c, {
      ...body,
      ownerModel: 'SpaceUser',
      userId: spaceUser.userId,
      organizationId: spaceUser.organizationId,
      spaceId: spaceUser.spaceId,
    });

    return respond.created(token);
  },
);
