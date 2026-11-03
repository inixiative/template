/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:auth
 */
import { includeTargetEntitlements, type Prisma, withEntitlementEntries } from '@template/db';
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { integrationReadManyTokensRoute } from '#/modules/integration/routes/integrationReadManyTokens';

export const integrationReadManyTokensController = makeController(
  integrationReadManyTokensRoute,
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
    return respond.ok(
      data.map((row) => withEntitlementEntries(row)),
      { pagination },
    );
  },
);
