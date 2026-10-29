/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */
import { hydrate, type Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { makeController } from '#/lib/utils/makeController';
import { tokenEntitlementsRoute } from '#/modules/token/routes/tokenEntitlements';
import { validateTokenWrite } from '#/modules/token/validations/validateTokenWrite';

export const tokenEntitlementsController = makeController(
  tokenEntitlementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permix = c.get('permix');
    const token = getResource<'token'>(c);
    await validateTokenWrite(permix, token);

    const entitlements = await changeEntitlements(permix, token.entitlements, c.req.valid('json'), {
      model: 'token',
      record: await hydrate('token', token),
    });
    const { keyHash: _keyHash, ...updated } = await db.token.update({
      where: { id: token.id },
      data: { entitlements: entitlements as Prisma.InputJsonValue },
    });
    return respond.ok(updated);
  },
);
