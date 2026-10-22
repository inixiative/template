/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */

import { hydrate } from '@template/db';
import { canAssign } from '@template/permissions/assign';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { spaceCreateTokenRoute } from '#/modules/space/routes/spaceCreateToken';

export const spaceCreateTokenController = makeController(
  spaceCreateTokenRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const space = getResource<'space'>(c);
    const body = c.req.valid('json');

    const hydrated = await hydrate('space', space);

    const owner = { model: 'space' as const, record: hydrated };
    if (!canAssign(permix, owner, owner, body.role, undefined)) {
      throw makeError({ status: 403, message: `Cannot create ${body.role} token` });
    }

    const token = await createToken(c, {
      name: body.name,
      ownerModel: 'Space',
      organizationId: space.organizationId,
      spaceId: space.id,
      role: body.role,
      entitlements: body.entitlements,
      expiresAt: body.expiresAt,
    });

    return respond.created(token);
  },
);
