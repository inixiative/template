/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { includeTargetEntitlements, type Prisma } from '@template/db';
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyTokensRoute } from '#/modules/space/routes/spaceReadManyTokens';

export const spaceReadManyTokensController = makeController(
  spaceReadManyTokensRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate<
      typeof db.token,
      Prisma.TokenGetPayload<{ include: typeof includeTargetEntitlements; omit: { keyHash: true } }>
    >(c, db.token, {
      include: includeTargetEntitlements,
      where: submodelOwnerWhere(c),
      omit: { keyHash: true },
    });
    return respond.ok(data, { pagination });
  },
);
