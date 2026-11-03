/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */
import { toEntitlementRowEntry } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { tokenReadManyEntitlementsRoute } from '#/modules/token/routes/tokenReadManyEntitlements';

export const tokenReadManyEntitlementsController = makeController(
  tokenReadManyEntitlementsRoute,
  async (c, respond) => {
    const token = getResource<'token'>(c);
    return respond.ok(token.targetEntitlements.map(toEntitlementRowEntry));
  },
);
