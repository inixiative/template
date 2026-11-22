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
import { customerRelationshipsByIdLens } from '#/modules/customerRelationship/lib/lenses/customerRelationshipsByIdLens';

export type HydratedCustomerRelationship = Record<string, unknown> & {
  id: string;
  segmentMembers: { segment: (Record<string, unknown> & { id: string }) | null }[];
};

export const hydrateCustomerRelationships = async (
  ownerModel: ProviderModel,
  ownerId: string,
  customerRelationshipIds: string[],
): Promise<HydratedCustomerRelationship[]> => {
  if (!customerRelationshipIds.length) return [];
  return fetchLens<HydratedCustomerRelationship>(
    bindLens(customerRelationshipsByIdLens, {
      ...polymorphicBindings(ownerModel, ownerId),
      customerRelationshipIds,
    }),
  );
};
