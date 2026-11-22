/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { includeTargetEntitlements, Prisma } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { contextResource } from '#/lib/context/contextResource';
import { assertTransition } from '#/lib/permissions/assertTransition';
import { makeController } from '#/lib/utils/makeController';
import { validateNotLastOwner } from '#/modules/organization/validations/validateNotLastOwner';
import { organizationUserUpdateRoute } from '#/modules/organizationUser/routes/organizationUserUpdate';

export const organizationUserUpdateController = makeController(
  organizationUserUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const orgUser = contextResource<'organizationUser'>(c);
    const body = c.req.valid('json');
    const permix = c.get('permix');

    await assertTransition(permix, 'organizationUser', 'changeRole', orgUser, {
      role: body.role ?? orgUser.role,
    });

    if (orgUser.role === Role.owner && body.role !== undefined && body.role !== Role.owner) {
      await validateNotLastOwner(orgUser.organizationId);
    }

    const updated = await db.organizationUser.update({
      where: { id: orgUser.id },
      include: includeTargetEntitlements('OrganizationUser'),
      data: body,
    });

    return respond.ok(updated);
  },
);
