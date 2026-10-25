/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { canGrantDelegateClaim } from '#/lib/permissions/canGrantDelegateClaim';
import { delegateClaimOf, delegateHolder } from '#/lib/permissions/delegateHolder';
import { validateDelegateClaim } from '#/lib/permissions/validateDelegateClaim';
import { makeController } from '#/lib/utils/makeController';
import { integrationUpdateRoute } from '#/modules/integration/routes/integrationUpdate';

const claimFields = ['role', 'full', 'entitlements'];

export const integrationUpdateController = makeController(
  integrationUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const integration = getResource<'integration'>(c);
    const body = c.req.valid('json');

    if (claimFields.some((field) => field in body)) {
      const claim = delegateClaimOf({ ...integration, ...body });
      validateDelegateClaim(integration.ownerModel, claim);
      const holder = await delegateHolder(integration);
      if (!(await canGrantDelegateClaim(c.get('permix'), holder, claim)))
        throw makeError({ status: 403, message: 'An integration holds your permissions or less' });
    }

    const updated = await db.integration.update({
      where: { id: integration.id },
      data: {
        ...body,
        entitlements: body.entitlements === null ? Prisma.DbNull : body.entitlements,
      } as Prisma.IntegrationUncheckedUpdateInput,
    });

    return respond.ok(updated);
  },
);
