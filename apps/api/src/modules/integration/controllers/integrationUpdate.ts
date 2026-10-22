/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates
 */
import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationUpdateRoute } from '#/modules/integration/routes/integrationUpdate';
import { bindIntegrationEntitlements } from '#/modules/integration/services/bindIntegrationEntitlements';

export const integrationUpdateController = makeController(
  integrationUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const integration = getResource<'integration'>(c);
    const body = c.req.valid('json');
    const merged = bindIntegrationEntitlements({
      ...integration,
      ...body,
    } as Prisma.IntegrationUncheckedCreateInput);
    const updated = await db.integration.update({
      where: { id: integration.id },
      data: {
        ...body,
        ...(body.entitlements === undefined ? {} : { entitlements: merged.entitlements }),
      } as Prisma.IntegrationUncheckedUpdateInput,
    });

    return respond.ok(updated);
  },
);
