/**
 * @atlas
 * @kind helper
 * @partOf feature:customer
 * @uses infrastructure:prisma
 */
import { bindLens, type LensNarrowing } from '@inixiative/json-rules';
import { polymorphicBindings } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { customerRefLens } from '#/modules/customerRef/lib/lenses/customerRefLens';

export const resolvedCustomerRefLens = (
  ownerModel: ProviderModel,
  ownerId: string,
): LensNarrowing => bindLens(customerRefLens, polymorphicBindings(ownerModel, ownerId));
