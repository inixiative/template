/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { bindLens } from '@inixiative/json-rules';
import { polymorphicBindings } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { fetchLens } from '@template/db/hydrate/fetchLens';
import { customerRefsByIdLens } from '#/modules/customerRef/lib/lenses/customerRefsByIdLens';

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
  return fetchLens<HydratedCustomerRef>(
    bindLens(customerRefsByIdLens, {
      ...polymorphicBindings(ownerModel, ownerId),
      customerRefIds,
    }),
  );
};
