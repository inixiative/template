/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { Prisma } from '@template/db';
import { validateRules } from '#/hooks/rules/hook';
import { getResource } from '#/lib/context/getResource';
import { delegateClaimOf, delegateHolder } from '#/lib/permissions/delegateHolder';
import { validateDelegateGrant } from '#/lib/permissions/validateDelegateGrant';
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
      const claimed = { ...integration, ...body };
      validateRules(claimed, 'Integration');
      await validateDelegateGrant(
        c.get('permix'),
        await delegateHolder(integration),
        delegateClaimOf(claimed),
      );
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
