/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { hydrate, type OrganizationId, Prisma } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import { memberRoleWrite } from '@template/permissions/rebac/schemaHelpers';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { validateEntitlementGrants } from '#/lib/permissions/validateEntitlementGrants';
import { makeController } from '#/lib/utils/makeController';
import { validateNotLastOwner } from '#/modules/organization/validations/validateNotLastOwner';
import { organizationUserUpdateRoute } from '#/modules/organizationUser/routes/organizationUserUpdate';

export const organizationUserUpdateController = makeController(
  organizationUserUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const orgUser = getResource<'organizationUser'>(c);
    const body = c.req.valid('json');
    const permix = c.get('permix');

    const before = await hydrate('organizationUser', orgUser);
    const after = await hydrate('organizationUser', {
      ...orgUser,
      role: body.role ?? orgUser.role,
    });
    if (
      !check(permix, rebacSchema, 'organizationUser', before, memberRoleWrite('organization')) ||
      !check(permix, rebacSchema, 'organizationUser', after, memberRoleWrite('organization'))
    )
      throw makeError({ status: 403, message: 'Access denied' });

    await validateEntitlementGrants(permix, body.entitlements ?? []);

    if (orgUser.role === Role.owner && body.role !== undefined && body.role !== Role.owner) {
      await validateNotLastOwner(orgUser.organizationId as OrganizationId);
    }

    const updated = await db.organizationUser.update({
      where: { id: orgUser.id },
      data: {
        ...body,
        entitlements:
          body.entitlements === null
            ? Prisma.DbNull
            : (body.entitlements as Prisma.InputJsonValue | undefined),
      },
    });

    return respond.ok(updated);
  },
);
