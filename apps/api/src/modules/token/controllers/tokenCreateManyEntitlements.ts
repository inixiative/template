/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */
import { contextResource } from '#/lib/context/contextResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateEntitlementWriter } from '#/lib/permissions/validateEntitlementWriter';
import { assertRecentTwoFactor } from '#/lib/twoFactor/assertRecentTwoFactor';
import { makeController } from '#/lib/utils/makeController';
import { tokenCreateManyEntitlementsRoute } from '#/modules/token/routes/tokenCreateManyEntitlements';

export const tokenCreateManyEntitlementsController = makeController(
  tokenCreateManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const token = contextResource<'token'>(c);
    const changes = { add: c.req.valid('json') };
    await validateEntitlementWriter(permix, 'Token', token, changes);
    await assertRecentTwoFactor(c);
    const entitlements = await changeEntitlements(
      permix,
      { model: 'Token', id: token.id },
      changes,
    );
    return respond.created(entitlements);
  },
);
