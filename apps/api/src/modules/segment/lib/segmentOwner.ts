/**
 * @atlas
 * @kind helper
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { db, type Prisma, polymorphicKeyColumn, polymorphicTarget } from '@template/db';
import type { CustomerRef, Segment } from '@template/db/generated/client/client';
import type { CustomerModel, ProviderModel } from '@template/db/generated/client/enums';

type OwnerColumns = { ownerModel: ProviderModel } & Record<string, unknown>;

export type Provider = { ownerModel: ProviderModel; ownerId: string };

export const segmentOwnerId = (segment: OwnerColumns): string =>
  polymorphicTarget(segment, 'Segment', 'ownerModel')?.id ?? segment.ownerModel;

export const customerRefProviderFk = (ownerModel: ProviderModel): string | null =>
  polymorphicKeyColumn('CustomerRef', 'providerModel', ownerModel);

export const customerRefCustomerFk = (customerModel: CustomerModel): string =>
  polymorphicKeyColumn('CustomerRef', 'customerModel', customerModel)!;

export const providerWhere = (ownerModel: ProviderModel, ownerId: string): Prisma.CustomerRefWhereInput => {
  const fk = customerRefProviderFk(ownerModel);
  return fk ? { providerModel: ownerModel, [fk]: ownerId } : { providerModel: ownerModel };
};

export const segmentOwnerWhere = (ownerModel: ProviderModel, ownerId: string): Prisma.SegmentWhereInput => {
  const fk = polymorphicKeyColumn('Segment', 'ownerModel', ownerModel);
  return fk ? { ownerModel, [fk]: ownerId } : { ownerModel };
};

/** Every live segment the owner holds, internal ones included — the reconcile view, not the nameable one. */
export const segmentsOf = (
  ownerModel: ProviderModel,
  ownerId: string,
  where: Prisma.SegmentWhereInput = {},
): Promise<Segment[]> =>
  db.segment.findMany({ where: { AND: [segmentOwnerWhere(ownerModel, ownerId), { deletedAt: null }, where] } });

export const providerOf = (customerRef: CustomerRef): Provider => {
  const target = polymorphicTarget(customerRef, 'CustomerRef', 'providerModel');
  return target
    ? { ownerModel: target.kind as ProviderModel, ownerId: target.id }
    : { ownerModel: customerRef.providerModel, ownerId: customerRef.providerModel };
};
