/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */
import { canAssign } from '@template/permissions/assign';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { organizationCreateTokenRoute } from '#/modules/organization/routes/organizationCreateToken';

export const organizationCreateTokenController = makeController(
  organizationCreateTokenRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const org = getResource<'organization'>(c);
    const body = c.req.valid('json');

    const owner = { model: 'organization' as const, record: org };
    if (!canAssign(permix, owner, owner, body.role, body.entitlements)) {
      throw makeError({ status: 403, message: `Cannot create ${body.role} token` });
    }

    const token = await createToken(c, {
      name: body.name,
      ownerModel: 'Organization',
      organizationId: org.id,
      role: body.role,
      entitlements: body.entitlements,
      entitlementsOnly: body.entitlementsOnly,
      expiresAt: body.expiresAt,
    });

    return respond.created(token);
  },
);
