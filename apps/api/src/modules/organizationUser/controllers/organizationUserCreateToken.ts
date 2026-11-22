/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { organizationUserCreateTokenRoute } from '#/modules/organizationUser/routes/organizationUserCreateToken';

export const organizationUserCreateTokenController = makeController(
  organizationUserCreateTokenRoute,
  async (c, respond) => {
    const orgUser = contextResource<'organizationUser'>(c);
    const body = c.req.valid('json');

    const token = await createToken(c, {
      ...body,
      ownerModel: 'OrganizationUser',
      userId: orgUser.userId,
      organizationId: orgUser.organizationId,
    });

    return respond.created(token);
  },
);
