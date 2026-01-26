import { roleToOrgAction } from '@template/permissions';
import { HTTPException } from 'hono/http-exception';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { organizationUserCreateTokenRoute } from '#/modules/organizationUser/routes/organizationUserCreateToken';

export const organizationUserCreateTokenController = makeController(organizationUserCreateTokenRoute, async (c, respond) => {
  const db = c.get('db');
  const orgUser = getResource<'organizationUser'>(c);
  const body = c.req.valid('json');

  if (!c.get('permix').check('organization', roleToOrgAction(body.role), orgUser.organizationId)) {
    throw new HTTPException(403, { message: `Cannot create ${body.role} token` });
  }

  const token = await createToken(db, {
    name: body.name,
    ownerModel: 'OrganizationUser',
    userId: orgUser.userId,
    organizationId: orgUser.organizationId,
    role: body.role,
    expiresAt: body.expiresAt,
  });

  return respond.created(token);
});
