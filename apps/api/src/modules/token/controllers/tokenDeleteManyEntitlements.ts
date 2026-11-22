/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */
import { contextResource } from '#/lib/context/contextResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateEntitlementWriter } from '#/lib/permissions/validateEntitlementWriter';
import { makeController } from '#/lib/utils/makeController';
import { tokenDeleteManyEntitlementsRoute } from '#/modules/token/routes/tokenDeleteManyEntitlements';

export const tokenDeleteManyEntitlementsController = makeController(
  tokenDeleteManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const token = contextResource<'token'>(c);
    const changes = { remove: c.req.valid('json') };
    await validateEntitlementWriter(permix, 'Token', token, changes);
    await changeEntitlements(permix, { model: 'Token', id: token.id }, changes);
    return respond.noContent();
  },
);
