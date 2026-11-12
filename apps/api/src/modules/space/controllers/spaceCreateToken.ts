/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { spaceCreateTokenRoute } from '#/modules/space/routes/spaceCreateToken';

export const spaceCreateTokenController = makeController(
  spaceCreateTokenRoute,
  async (c, respond) => {
    const space = getResource<'space'>(c);
    const body = c.req.valid('json');

    const token = await createToken(c, {
      ...body,
      ownerModel: 'Space',
      organizationId: space.organizationId,
      spaceId: space.id,
    });

    return respond.created(token);
  },
);
