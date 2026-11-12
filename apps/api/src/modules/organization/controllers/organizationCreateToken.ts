/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { organizationCreateTokenRoute } from '#/modules/organization/routes/organizationCreateToken';

export const organizationCreateTokenController = makeController(
  organizationCreateTokenRoute,
  async (c, respond) => {
    const org = getResource<'organization'>(c);
    const body = c.req.valid('json');

    const token = await createToken(c, {
      ...body,
      ownerModel: 'Organization',
      organizationId: org.id,
    });

    return respond.created(token);
  },
);
