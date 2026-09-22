/**
 * @atlas
 * @kind service
 * @partOf feature:customer
 * @uses infrastructure:prisma, primitive:appEvents
 */
import { db } from '@template/db';
import type { CustomerModel } from '@template/db/generated/client/enums';
import { emitAppEvent } from '#/appEvents/emit';
import { provisionPlatformCustomerRef } from '#/modules/customerRef/services/provisionPlatformCustomerRef';

export type BackfillCounts = Record<CustomerModel, { created: number; revived: number; present: number }>;

const PAGE = 500;

const customerDelegates = {
  User: () => db.user,
  Organization: () => db.organization,
  Space: () => db.space,
} as const;

const liveIdsOf = async (customerModel: CustomerModel): Promise<string[]> => {
  const delegate = customerDelegates[customerModel]() as { findMany: (args: unknown) => Promise<{ id: string }[]> };
  const ids: string[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await delegate.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    ids.push(...page.map((row) => row.id));
    if (page.length < PAGE) return ids;
    cursor = page[page.length - 1]!.id;
  }
};

export const backfillPlatformCustomerRefs = async (): Promise<BackfillCounts> => {
  const counts: BackfillCounts = {
    User: { created: 0, revived: 0, present: 0 },
    Organization: { created: 0, revived: 0, present: 0 },
    Space: { created: 0, revived: 0, present: 0 },
  };
  for (const customerModel of Object.keys(customerDelegates) as CustomerModel[]) {
    for (const id of await liveIdsOf(customerModel)) {
      const { customerRef, outcome } = await provisionPlatformCustomerRef(customerModel, id);
      counts[customerModel][outcome] += 1;
      if (outcome !== 'present') await emitAppEvent('customerRef.created', { customerRef });
    }
  }
  return counts;
};
