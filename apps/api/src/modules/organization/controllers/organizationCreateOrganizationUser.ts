import { check, rebacSchema } from '@template/permissions/rebac';
import { HTTPException } from 'hono/http-exception';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateOrganizationUserRoute } from '#/modules/organization/routes/organizationCreateOrganizationUser';
import { validateOrganizationCreateOrganizationUserBody } from '#/modules/organization/validations/organizationCreateOrganizationUserBody';
import { findUserOrCreateGuest } from '#/modules/user/services/findOrCreateGuest';

export const organizationCreateOrganizationUserController = makeController(
  organizationCreateOrganizationUserRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);
    const body = c.req.valid('json');
    const permix = c.get('permix');

    validateOrganizationCreateOrganizationUserBody(body);
    if (!check(permix, rebacSchema, 'organization', { id: org.id, role: body.role }, 'assign'))
      throw new HTTPException(403, { message: 'Access denied' });

    const userId = body.userId ?? (await findUserOrCreateGuest(db, { email: body.email!, name: body.name })).id;

    const orgUser = await db.organizationUser.create({
      data: {
        organizationId: org.id,
        userId,
        role: body.role,
      },
      include: { user: true },
    });

    return respond.created(orgUser);
  },
);
