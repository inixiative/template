import { hydrate } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { tokenDeleteRoute } from '#/modules/token/routes/tokenDelete';

export const tokenDeleteController = makeController(tokenDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const token = getResource<'token'>(c);
  const permix = c.get('permix');

  // `leave` covers self-delete (any userId-bearing token); `assign` covers
  // owner-side delete with the token's role baked in. Both paths live in
  // rebac — see token's entry in packages/permissions/src/rebac/schema.ts.
  const hydrated = await hydrate(db, 'token', token);
  const canDelete =
    check(permix, rebacSchema, 'token', hydrated, 'leave') ||
    check(permix, rebacSchema, 'token', hydrated, 'assign');
  if (!canDelete) throw makeError({ status: 403, message: 'Access denied' });

  await db.token.delete({ where: { id: token.id } });

  return respond.noContent();
});
