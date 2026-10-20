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
import { spaceUserCreateTokenRoute } from '#/modules/spaceUser/routes/spaceUserCreateToken';

export const spaceUserCreateTokenController = makeController(
  spaceUserCreateTokenRoute,
  async (c, respond) => {
    const spaceUser = getResource<'spaceUser'>(c);
    const body = c.req.valid('json');

    const credential = {
      ownerModel: 'SpaceUser' as const,
      userId: spaceUser.userId,
      organizationId: spaceUser.organizationId,
      spaceId: spaceUser.spaceId,
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
