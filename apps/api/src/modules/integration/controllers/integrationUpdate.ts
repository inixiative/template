/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { check } from '@inixiative/json-rules';
import type { Prisma } from '@template/db';
import { wellFormedEntitlements } from '@template/permissions';
import { delegateHoldsSomething } from '#/hooks/rules/delegatePermissionRules';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { integrationUpdateRoute } from '#/modules/integration/routes/integrationUpdate';
import { validateIntegrationRole } from '#/modules/integration/validations/validateIntegrationGrant';

const permissionFields = ['role', 'full'];

export const integrationUpdateController = makeController(
  integrationUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const integration = getResource<'integration'>(c);
    const body = c.req.valid('json');

    if (permissionFields.some((field) => field in body)) {
      await validateIntegrationRole(c.get('permix'), integration);
      await validateIntegrationRole(c.get('permix'), { ...integration, ...body });
    }
    const losesItsRole = integration.role !== null && 'role' in body && body.role === null;
    if (
      losesItsRole &&
      check(delegateHoldsSomething, {
        ...integration,
        ...body,
        entitlements: wellFormedEntitlements(integration.entitlements),
      }) !== true
    )
      throw makeError({
        status: 422,
        message: 'an integration with no role is full or holds entitlements',
      });

    const updated = await db.integration.update({
      where: { id: integration.id },
      data: body as Prisma.IntegrationUncheckedUpdateInput,
    });

    return respond.ok(updated);
  },
);
