/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, infrastructure:prisma
 */
import { type HydratedRecord, hydrate, Prisma } from '@template/db';
import type { Entitlements } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { assignLevel } from '#/lib/permissions/assignLevel';
import { validateHeldGrant } from '#/lib/permissions/validateHeldGrant';
import { validateRole } from '#/lib/permissions/validateRole';
import { makeController } from '#/lib/utils/makeController';
import { tokenUpdateRoute } from '#/modules/token/routes/tokenUpdate';

const denied = () => makeError({ status: 403, message: 'Cannot make this change to the token' });

export const tokenUpdateController = makeController(tokenUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const token = getResource<'token'>(c);
  const body = c.req.valid('json');

  if (c.get('token')?.id === token.id)
    throw makeError({ status: 403, message: 'A token cannot change itself' });

  const next = {
    role: validateRole(body.role ?? token.role),
    entitlements:
      body.entitlements === undefined ? (token.entitlements as Entitlements) : body.entitlements,
    entitlementsOnly: body.entitlementsOnly ?? token.entitlementsOnly,
  };

  const hydrated = await hydrate('token', token as HydratedRecord);
  const assigns = check(
    permix,
    rebacSchema,
    'token',
    { ...hydrated, role: assignLevel(next.role, next.entitlements) },
    'assign',
  );

  if (!assigns) {
    if (!check(permix, rebacSchema, 'token', hydrated, 'leave')) throw denied();
    await validateHeldGrant(c, next);
  }

  const { keyHash: _keyHash, ...updated } = await db.token.update({
    where: { id: token.id },
    data: {
      name: body.name,
      role: next.role,
      entitlements:
        next.entitlements === null ? Prisma.DbNull : (next.entitlements as Prisma.InputJsonValue),
      entitlementsOnly: next.entitlementsOnly,
    },
  });

  return respond.ok(updated);
});
