/**
 * @atlas
 * @kind helper
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { type Prisma, polymorphicKeyColumn, polymorphicTarget } from '@template/db';
import type { CustomerRef } from '@template/db/generated/client/client';
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

export const providerOf = (customerRef: CustomerRef): Provider => {
  const target = polymorphicTarget(customerRef, 'CustomerRef', 'providerModel');
  return target
    ? { ownerModel: target.kind as ProviderModel, ownerId: target.id }
    : { ownerModel: customerRef.providerModel, ownerId: customerRef.providerModel };
};
