/**
 * @atlas
 * @kind helper
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { polymorphicKeyColumn, polymorphicTarget } from '@template/db';
import type { CustomerModel, ProviderModel } from '@template/db/generated/client/enums';

type OwnerColumns = { ownerModel: ProviderModel } & Record<string, unknown>;

export const segmentOwnerFk = (ownerModel: ProviderModel): string =>
  polymorphicKeyColumn('Segment', 'ownerModel', ownerModel)!;

export const segmentOwnerId = (segment: OwnerColumns): string =>
  polymorphicTarget(segment, 'Segment', 'ownerModel')!.id;

export const customerRefProviderFk = (ownerModel: ProviderModel): string =>
  polymorphicKeyColumn('CustomerRef', 'providerModel', ownerModel)!;

export const customerRefCustomerFk = (customerModel: CustomerModel): string =>
  polymorphicKeyColumn('CustomerRef', 'customerModel', customerModel)!;
