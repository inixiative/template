/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */

import type { OrganizationId } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { type Entitlements, greaterRole } from '@template/permissions';
import { canAssign } from '@template/permissions/assign';
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

    const owner = { model: 'organization' as const, record: { id: orgUser.organizationId } };
    if (
      !canAssign(
        permix,
        owner,
        owner,
        greaterRole(orgUser.role, body.role),
        (body.entitlements ?? null) as Entitlements,
      )
    )
      throw makeError({ status: 403, message: 'Access denied' });

    if (orgUser.role === Role.owner && body.role !== Role.owner) {
      await validateNotLastOwner(db, orgUser.organizationId as OrganizationId);
    }

    const updated = await db.organizationUser.update({
      where: { id: orgUser.id },
      data: body,
    });

    return respond.ok(updated);
  },
);
