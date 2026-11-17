/**
 * @atlas
 * @kind helper
 * @partOf feature:customer
 * @uses infrastructure:prisma
 */
import { bindLens, type LensNarrowing } from '@inixiative/json-rules';
import { polymorphicBindings } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { customerRelationshipLens } from '#/modules/customerRelationship/lib/lenses/customerRelationshipLens';

export const resolvedCustomerRelationshipLens = (
  ownerModel: ProviderModel,
  ownerId: string,
): LensNarrowing => bindLens(customerRelationshipLens, polymorphicBindings(ownerModel, ownerId));
