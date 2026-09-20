/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { type LensNarrowing, Operator } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { fetchLens } from '@template/db/hydrate/fetchLens';
import { resolvedCustomerRefLens } from '#/modules/customerRef/lib/customerRefLens';

export type HydratedCustomerRef = Record<string, unknown> & {
  id: string;
  segmentMembers: { segment: (Record<string, unknown> & { id: string }) | null }[];
};

export const hydrateCustomerRefs = async (
  ownerModel: ProviderModel,
  ownerId: string,
  customerRefIds: string[],
): Promise<HydratedCustomerRef[]> => {
  if (!customerRefIds.length) return [];
  const lens: LensNarrowing = {
    parent: resolvedCustomerRefLens(ownerModel, ownerId),
    root: { where: { field: 'id', operator: Operator.in, value: customerRefIds } },
  };
  return fetchLens<HydratedCustomerRef>(db, lens);
};
