/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */
import { getResource } from '#/lib/context/getResource';
import { validateHeldGrant } from '#/lib/permissions/validateHeldGrant';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { organizationUserCreateTokenRoute } from '#/modules/organizationUser/routes/organizationUserCreateToken';

export const organizationUserCreateTokenController = makeController(
  organizationUserCreateTokenRoute,
  async (c, respond) => {
    const orgUser = getResource<'organizationUser'>(c);
    const body = c.req.valid('json');

    const credential = {
      ownerModel: 'OrganizationUser' as const,
      userId: orgUser.userId,
      organizationId: orgUser.organizationId,
      spaceId: null,
    };
    await validateHeldGrant(
      c,
      {
        role: body.role,
        entitlements: body.entitlements ?? null,
        entitlementsOnly: body.entitlementsOnly ?? false,
      },
      credential,
    );

    const token = await createToken(c, {
      ...credential,
      name: body.name,
      role: body.role,
      entitlements: body.entitlements,
      entitlementsOnly: body.entitlementsOnly,
      expiresAt: body.expiresAt,
      integrationId: body.integrationId,
      integrationReach: body.integrationReach,
      integrationReachIds: body.integrationReachIds,
    });

    return respond.created(token);
  },
);
