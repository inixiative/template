/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */
import {
  type HydratedRecord,
  hydrate,
  includeTargetEntitlements,
  withEntitlementEntries,
} from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { validateDelegateRole } from '#/lib/permissions/validateDelegateRole';
import { makeController } from '#/lib/utils/makeController';
import { tokenUpdateRoute } from '#/modules/token/routes/tokenUpdate';
import { validateTokenWrite } from '#/modules/token/validations/validateTokenWrite';

export const tokenUpdateController = makeController(tokenUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const token = getResource<'token'>(c);
  const body = c.req.valid('json');
  await validateTokenWrite(permix, token);
  await validateTokenWrite(permix, { ...token, ...body });
  validateDelegateRole(await hydrate('token', { ...token, ...body } as HydratedRecord));

  await db.token.update({ where: { id: token.id }, data: body });
  const { keyHash: _keyHash, ...updated } = await db.token.findUniqueOrThrow({
    where: { id: token.id },
    include: includeTargetEntitlements,
  });
  return respond.ok(withEntitlementEntries(updated));
});
