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
import { tokenDeleteManyEntitlementsRoute } from '#/modules/token/routes/tokenDeleteManyEntitlements';
import { validateTokenWrite } from '#/modules/token/validations/validateTokenWrite';

export const tokenDeleteManyEntitlementsController = makeController(
  tokenDeleteManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const token = getResource<'token'>(c);
    await validateTokenWrite(permix, token);
    validateDelegateRole(await hydrate('token', token as HydratedRecord));
    await changeEntitlements(
      permix,
      { model: 'Token', id: token.id },
      {
        remove: c.req.valid('json'),
      },
    );
    return respond.noContent();
  },
);
