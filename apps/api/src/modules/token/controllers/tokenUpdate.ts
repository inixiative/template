/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */

import { type HydratedRecord, hydrate, Prisma } from '@template/db';
import type { Entitlements } from '@template/permissions';
import { canAssign } from '@template/permissions/assign';
import { check, rebacSchema } from '@template/permissions/rebac';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { resolveIntegrationReach } from '#/lib/permissions/resolveIntegrationReach';
import { validateFullGrantIssuer } from '#/lib/permissions/validateFullGrantIssuer';
import { validateHeldGrant } from '#/lib/permissions/validateHeldGrant';
import { validateRole } from '#/lib/permissions/validateRole';
import { makeController } from '#/lib/utils/makeController';
import { integrationOwnerScope } from '#/modules/integration/services/integrationOwnerScope';
import { tokenUpdateRoute } from '#/modules/token/routes/tokenUpdate';

const denied = () => makeError({ status: 403, message: 'Cannot make this change to the token' });

export const tokenUpdateController = makeController(tokenUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const token = getResource<'token'>(c);
  const body = c.req.valid('json');

  if (c.get('token')?.id === token.id)
    throw makeError({ status: 403, message: 'A token cannot change itself' });

  const next = {
    role: validateRole(body.role ?? token.role),
    entitlements:
      body.entitlements === undefined ? (token.entitlements as Entitlements) : body.entitlements,
    entitlementsOnly: body.entitlementsOnly ?? token.entitlementsOnly,
  };

  const hydrated = await hydrate('token', token as HydratedRecord);
  const ownerRecord = (hydrated.space ?? hydrated.organization) as HydratedRecord | undefined;
  const assigns =
    !!ownerRecord &&
    canAssign(
      permix,
      { model: 'token', record: hydrated },
      { model: hydrated.space ? 'space' : 'organization', record: ownerRecord },
      next.role,
      next.entitlements,
    );

  validateFullGrantIssuer(c, next);

  if (!assigns) {
    if (!check(permix, rebacSchema, 'token', hydrated, 'leave')) throw denied();
    await validateHeldGrant(c, next);
  }

  const reach =
    body.integrationReach === undefined && body.integrationReachIds === undefined
      ? {}
      : await resolveIntegrationReach(
          {
            integrationReach: body.integrationReach ?? token.integrationReach,
            integrationReachIds: body.integrationReachIds,
          },
          token.integrationId,
          integrationOwnerScope(token),
        );

  const { keyHash: _keyHash, ...updated } = await db.token.update({
    where: { id: token.id },
    data: {
      name: body.name,
      role: next.role,
      entitlements:
        next.entitlements === null ? Prisma.DbNull : (next.entitlements as Prisma.InputJsonValue),
      entitlementsOnly: next.entitlementsOnly,
      ...reach,
    },
  });

  return respond.ok(updated);
});
