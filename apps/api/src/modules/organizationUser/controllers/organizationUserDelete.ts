import { Role } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import { HTTPException } from 'hono/http-exception';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { validateNotLastOwner } from '#/modules/organization/validations/validateNotLastOwner';
import { organizationUserDeleteRoute } from '#/modules/organizationUser/routes/organizationUserDelete';

export const organizationUserDeleteController = makeController(organizationUserDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const orgUser = getResource<'organizationUser'>(c);
  const permix = c.get('permix');

  const canLeave = check(permix, rebacSchema, 'organizationUser', orgUser, 'leave');
  const canAssign = check(
    permix,
    rebacSchema,
    'organization',
    { id: orgUser.organizationId as any, role: orgUser.role },
    'assign',
  );
  if (!canLeave && !canAssign) throw new HTTPException(403, { message: 'Access denied' });
  if (orgUser.role === Role.owner) await validateNotLastOwner(db, orgUser.organizationId as any);

  await db.organizationUser.delete({ where: { id: orgUser.id } });

  return respond.noContent();
});
