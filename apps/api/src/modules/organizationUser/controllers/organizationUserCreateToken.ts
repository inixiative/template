/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */
import { roleToStandardAction } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
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
    const checkOrg = check(
      permix,
      rebacSchema,
      'organization',
      { id: orgUser.organizationId },
      roleToStandardAction(body.role),
    );
    if (!checkLeave || !checkOrg)
      throw makeError({ status: 403, message: `Cannot create ${body.role} token` });

    const token = await createToken(c, {
      name: body.name,
      ownerModel: 'OrganizationUser',
      userId: orgUser.userId,
      organizationId: orgUser.organizationId,
      role: body.role,
      entitlements: body.entitlements,
      expiresAt: body.expiresAt,
    });

    return respond.created(token);
  },
);
