/**
 * @atlas
 * @kind type
 * @partOf feature:customerRelationship
 * @uses infrastructure:prisma
 */
import { type ModelName, rowPolymorphicAxisPointsAt } from '@template/db';
import type { CustomerRelationship } from '@template/db/generated/client/client';
import type { CustomerModel, ProviderModel } from '@template/db/generated/client/enums';

export type CustomerSide = { customerModel: CustomerModel; customerId: string };

export type ProviderSide = { providerModel: ProviderModel; providerId: string };

export const customerSideOfRow = (
  { model, axis }: { model: ModelName; axis: string },
  row: Record<string, unknown>,
): CustomerSide | null => {
  const target = rowPolymorphicAxisPointsAt(row, model, axis);
  return target ? { customerModel: target.model as CustomerModel, customerId: target.id } : null;
};

export const providerSideOfCustomerRelationship = (
  customerRelationship: CustomerRelationship,
): ProviderSide | null => {
  const target = rowPolymorphicAxisPointsAt(
    customerRelationship,
    'CustomerRelationship',
    'providerModel',
  );
  return target ? { providerModel: target.model as ProviderModel, providerId: target.id } : null;
};
