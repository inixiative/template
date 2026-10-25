/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */
import { hydrate } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { organizationUserCreateTokenRoute } from '#/modules/organizationUser/routes/organizationUserCreateToken';

export const organizationUserCreateTokenController = makeController(
  organizationUserCreateTokenRoute,
  async (c, respond) => {
    const orgUser = getResource<'organizationUser'>(c);
    const body = c.req.valid('json');

    const ownSeat = check(
      c.get('permix'),
      rebacSchema,
      'organizationUser',
      await hydrate('organizationUser', orgUser),
      'leave',
    );
    if (!ownSeat)
      throw makeError({ status: 403, message: 'Only the seat itself mints its tokens' });

    const token = await createToken(c, {
      ...body,
      ownerModel: 'OrganizationUser',
      userId: orgUser.userId,
      organizationId: orgUser.organizationId,
    });

    return respond.created(token);
  },
);
