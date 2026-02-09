import { db } from '@template/db';
import { roleToStandardAction } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { HTTPException } from 'hono/http-exception';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { organizationUserCreateTokenRoute } from '#/modules/organizationUser/routes/organizationUserCreateToken';

export const organizationUserCreateTokenController = makeController(
  organizationUserCreateTokenRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const orgUser = getResource<'organizationUser'>(c);
    const body = c.req.valid('json');

    const checkLeave = check(permix, rebacSchema, 'organizationUser', orgUser, 'leave');
    // Option A: User can create tokens at or below their own role level
    const checkOrg = check(
      permix,
      rebacSchema,
      'organization',
      { id: orgUser.organizationId },
      roleToStandardAction(body.role),
    );
    // Option B: Only admins+ can create tokens (uses 'assign' rules)
    // const checkOrg = check(permix, rebacSchema, 'organization', { id: orgUser.organizationId, role: body.role }, 'assign');
    if (!checkLeave || !checkOrg) throw new HTTPException(403, { message: `Cannot create ${body.role} token` });

    const token = await createToken(db, {
      name: body.name,
      ownerModel: 'OrganizationUser',
      userId: orgUser.userId,
      organizationId: orgUser.organizationId,
      role: body.role,
      expiresAt: body.expiresAt,
    });

    return respond.created(token);
  },
);
