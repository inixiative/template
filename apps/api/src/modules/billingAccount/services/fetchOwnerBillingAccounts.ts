/**
 * @atlas
 * @kind service
 * @partOf feature:billing
 * @uses infrastructure:prisma, primitive:authz
 */
import type { HydratedRecord } from '@template/db';
import { hydrate } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { toBillingAccountResponse } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import type { AppEnv } from '#/types/appEnv';

export const fetchOwnerBillingAccounts = async (c: Context<AppEnv>) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const ownerWhere = submodelOwnerWhere(c);

  const hydratedBase = await hydrate('billingAccount', {
    id: '',
    ...ownerWhere,
    isShared: false,
  } as unknown as HydratedRecord);

  const canReadAll = check(permix, rebacSchema, 'billingAccount', hydratedBase, 'read');

  let where: Record<string, unknown> = ownerWhere;
  if (!canReadAll) {
    const candidates = await db.billingAccount.findMany({
      where: { ...ownerWhere, deletedAt: null },
      select: { id: true, isShared: true },
    });
    const readableIds = candidates
      .filter((candidate) =>
        check(
          permix,
          rebacSchema,
          'billingAccount',
          { ...hydratedBase, id: candidate.id, isShared: candidate.isShared } as HydratedRecord,
          'read',
        ),
      )
      .map((candidate) => candidate.id);
    where = { ...ownerWhere, id: { in: readableIds } };
  }

  const { data, pagination } = await paginate(c, db.billingAccount, {
    where,
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  return { data: data.map(toBillingAccountResponse), pagination };
};
