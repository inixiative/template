import type { AccessorName } from '@template/db';
import { hydrate } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { HTTPException } from 'hono/http-exception';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { tokenDeleteRoute } from '#/modules/token/routes/tokenDelete';

export const tokenDeleteController = makeController(tokenDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const token = getResource<'token'>(c);
  const permix = c.get('permix');

  const canLeave = check(permix, rebacSchema, 'token', token, 'leave');
  if (!canLeave) {
    const [ownerId, ownerType] = token.spaceId
      ? [token.spaceId, 'space' as AccessorName]
      : [token.organizationId, 'organization' as AccessorName];
    const owner = await hydrate(db, ownerType, { id: ownerId! });
    if (!check(permix, rebacSchema, ownerType, { ...owner, role: token.role }, 'assign'))
      throw new HTTPException(403, { message: 'Access denied' });
  }

  await db.token.delete({ where: { id: token.id } });

  return respond.noContent();
});
