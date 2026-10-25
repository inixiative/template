/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { type OrganizationId, Prisma } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { greaterRole } from '@template/permissions';
import { canGrantEntitlement, check, rebacSchema } from '@template/permissions/rebac';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
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

    const role = greaterRole(orgUser.role, body.role);
    if (
      !check(
        permix,
        rebacSchema,
        'organization',
        { id: orgUser.organizationId as OrganizationId, role },
        'assign',
      )
    )
      throw makeError({ status: 403, message: 'Access denied' });

    const organization = { id: orgUser.organizationId as OrganizationId };
    const granted = body.entitlements && {
      resource: 'db:organization',
      anchor: { resource: 'db:organization', id: organization.id },
      actions: body.entitlements,
    };
    if (granted && !canGrantEntitlement(permix, granted, organization))
      throw makeError({ status: 403, message: 'Access denied' });

    if (orgUser.role === Role.owner && body.role !== undefined && body.role !== Role.owner) {
      await validateNotLastOwner(orgUser.organizationId as OrganizationId);
    }

    const updated = await db.organizationUser.update({
      where: { id: orgUser.id },
      data: {
        ...body,
        entitlements: body.entitlements === null ? Prisma.DbNull : body.entitlements,
      },
    });

    return respond.ok(updated);
  },
);
