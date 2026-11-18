/**
 * @atlas
 * @kind utils
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { polymorphicKeyColumn, rowPolymorphicAxisPointsAt } from '@template/db';
import type { CustomerModel, ProviderModel } from '@template/db/generated/client/enums';

type OwnerColumns = { ownerModel: ProviderModel } & Record<string, unknown>;

export const segmentOwnerFk = (ownerModel: ProviderModel): string =>
  polymorphicKeyColumn('Segment', 'ownerModel', ownerModel)!;

export const segmentOwnerId = (segment: OwnerColumns): string =>
  rowPolymorphicAxisPointsAt(segment, 'Segment', 'ownerModel')!.id;

export const customerRelationshipProviderFk = (ownerModel: ProviderModel): string =>
  polymorphicKeyColumn('CustomerRelationship', 'providerModel', ownerModel)!;

export const customerRelationshipCustomerFk = (customerModel: CustomerModel): string =>
  polymorphicKeyColumn('CustomerRelationship', 'customerModel', customerModel)!;
