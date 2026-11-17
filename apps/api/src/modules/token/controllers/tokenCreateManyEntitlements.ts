/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */
import { getResource } from '#/lib/context/getResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateEntitlementWriter } from '#/lib/permissions/validateEntitlementWriter';
import { makeController } from '#/lib/utils/makeController';
import { tokenCreateManyEntitlementsRoute } from '#/modules/token/routes/tokenCreateManyEntitlements';

export const tokenCreateManyEntitlementsController = makeController(
  tokenCreateManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const token = getResource<'token'>(c);
    const changes = { add: c.req.valid('json') };
    await validateEntitlementWriter(permix, 'Token', token, changes);
    const entitlements = await changeEntitlements(
      permix,
      { model: 'Token', id: token.id },
      changes,
    );
    return respond.created(entitlements);
  },
);
