/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationCreateTokenRoute } from '#/modules/integration/routes/integrationCreateToken';
import { createToken } from '#/modules/me/services/createToken';

export const integrationCreateTokenController = makeController(
  integrationCreateTokenRoute,
  async (c, respond) => {
    const integration = getResource<'integration'>(c);
    const body = c.req.valid('json');

    const token = await createToken(c, {
      name: body.name,
      ownerModel: 'Integration',
      integrationId: integration.id,
      role: body.role,
      expiresAt: body.expiresAt,
    });

    return respond.created(token);
  },
);
