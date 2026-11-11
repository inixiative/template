/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */
import { type HydratedRecord, hydrate } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateDelegateRole } from '#/lib/permissions/validateDelegateRole';
import { makeController } from '#/lib/utils/makeController';
import { tokenCreateManyEntitlementsRoute } from '#/modules/token/routes/tokenCreateManyEntitlements';
import { validateTokenWrite } from '#/modules/token/validations/validateTokenWrite';

export const tokenCreateManyEntitlementsController = makeController(
  tokenCreateManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const token = getResource<'token'>(c);
    await validateTokenWrite(permix, token);
    validateDelegateRole(await hydrate('token', token as HydratedRecord));
    const entitlements = await changeEntitlements(
      permix,
      { model: 'Token', id: token.id },
      {
        add: c.req.valid('json'),
      },
    );
    return respond.created(entitlements);
  },
);
