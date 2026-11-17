/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */
import { type HydratedRecord, hydrate } from '@template/db';
import { TokenAction } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { makeController } from '#/lib/utils/makeController';
import { tokenDeleteManyEntitlementsRoute } from '#/modules/token/routes/tokenDeleteManyEntitlements';

export const tokenDeleteManyEntitlementsController = makeController(
  tokenDeleteManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const token = getResource<'token'>(c);
    const row = await hydrate('token', token as HydratedRecord);
    // why: minting needs only access to the owner; taking a row away is administering the token
    if (!check(permix, rebacSchema, 'token', row, TokenAction.delete))
      throw makeError({ status: 403, message: 'Access denied' });
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
