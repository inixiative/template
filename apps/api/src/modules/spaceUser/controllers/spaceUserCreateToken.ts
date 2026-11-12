/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { spaceUserCreateTokenRoute } from '#/modules/spaceUser/routes/spaceUserCreateToken';

export const spaceUserCreateTokenController = makeController(
  spaceUserCreateTokenRoute,
  async (c, respond) => {
    const spaceUser = getResource<'spaceUser'>(c);
    const body = c.req.valid('json');

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
