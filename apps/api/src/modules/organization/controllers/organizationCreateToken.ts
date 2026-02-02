import { db } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { HTTPException } from 'hono/http-exception';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { organizationCreateTokenRoute } from '#/modules/organization/routes/organizationCreateToken';

export const organizationCreateTokenController = makeController(organizationCreateTokenRoute, async (c, respond) => {
  const permix = c.get('permix');
  const org = getResource<'organization'>(c);
  const body = c.req.valid('json');

  if (!check(permix, rebacSchema, 'organization', { ...org, role: body.role }, 'assign')) {
    throw new HTTPException(403, { message: `Cannot create ${body.role} token` });
  }

  const token = await createToken(db, {
    name: body.name,
    ownerModel: 'Organization',
    organizationId: org.id,
    role: body.role,
    expiresAt: body.expiresAt,
  });

  return respond.created(token);
});
