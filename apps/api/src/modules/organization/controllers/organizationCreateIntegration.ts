/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateIntegrationRoute } from '#/modules/organization/routes/organizationCreateIntegration';

export const organizationCreateIntegrationController = makeController(
  organizationCreateIntegrationRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource<'organization'>(c);
    const body = c.req.valid('json');

    const integration = await db.integration.create({
      data: {
        ...body,
        ownerModel: 'Organization',
        organizationId: organization.id,
      } as Prisma.IntegrationUncheckedCreateInput,
    });

    return respond.created(integration);
  },
);
