/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */
import { type HydratedRecord, hydrate, includeTargetEntitlements } from '@template/db';
import { contextResource } from '#/lib/context/contextResource';
import { validateDelegateRole } from '#/lib/permissions/validateDelegateRole';
import { assertNotSuperadminTokenWithTwoFactor } from '#/lib/twoFactor/assertNotSuperadminTokenWithTwoFactor';
import { assertRecentTwoFactor } from '#/lib/twoFactor/assertRecentTwoFactor';
import { makeController } from '#/lib/utils/makeController';
import { tokenUpdateRoute } from '#/modules/token/routes/tokenUpdate';
import { validateTokenWrite } from '#/modules/token/validations/validateTokenWrite';

export const tokenUpdateController = makeController(tokenUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const token = contextResource<'token'>(c);
  const body = c.req.valid('json');
  await validateTokenWrite(permix, token);
  await validateTokenWrite(permix, { ...token, ...body });
  if (body.role !== undefined || body.full !== undefined) {
    assertNotSuperadminTokenWithTwoFactor(c);
    await assertRecentTwoFactor(c);
  }
  validateDelegateRole(await hydrate('token', { ...token, ...body } as HydratedRecord));

  await db.token.update({ where: { id: token.id }, data: body });
  const { keyHash: _keyHash, ...updated } = await db.token.findUniqueOrThrow({
    where: { id: token.id },
    include: includeTargetEntitlements('Token'),
  });
  return respond.ok(updated);
});
