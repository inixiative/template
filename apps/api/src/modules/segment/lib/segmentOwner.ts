/**
 * @atlas
 * @kind utils
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { polymorphicKeyColumnOrThrow, rowPolymorphicAxisPointsAt } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';

type OwnerColumns = { ownerModel: ProviderModel } & Record<string, unknown>;

export const segmentOwnerFk = (ownerModel: ProviderModel): string =>
  polymorphicKeyColumnOrThrow('Segment', 'ownerModel', ownerModel);

export const segmentOwnerId = (segment: OwnerColumns): string =>
  rowPolymorphicAxisPointsAt(segment, 'Segment', 'ownerModel')!.id;

export const customerRelationshipProviderFk = (ownerModel: ProviderModel): string =>
  polymorphicKeyColumnOrThrow('CustomerRelationship', 'providerModel', ownerModel);
