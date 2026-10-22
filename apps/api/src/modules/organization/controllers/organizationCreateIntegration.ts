/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { bindIntegrationEntitlements } from '#/modules/integration/services/bindIntegrationEntitlements';
import { validateReachableIntegration } from '#/modules/integration/validations/validateReachableIntegration';
import { organizationCreateIntegrationRoute } from '#/modules/organization/routes/organizationCreateIntegration';

export const organizationCreateIntegrationController = makeController(
  organizationCreateIntegrationRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource<'organization'>(c);
    const body = c.req.valid('json');
    await validateReachableIntegration(c, {
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const draft = bindIntegrationEntitlements({
      ...body,
      ownerModel: 'Organization',
      organizationId: organization.id,
    } as Prisma.IntegrationUncheckedCreateInput);
    const integration = await db.integration.create({ data: draft });

    return respond.created(integration);
  },
);
