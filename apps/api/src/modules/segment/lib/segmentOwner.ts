/**
 * @atlas
 * @kind helper
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { PolymorphismRegistry, resolveFalsePolymorphismRef } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';

type OwnerColumns = {
  ownerModel: ProviderModel;
  userId?: string | null;
  organizationId?: string | null;
  spaceId?: string | null;
};

const ownerAxis = PolymorphismRegistry.Segment!.axes[0]!;

export const segmentOwnerFk = (ownerModel: ProviderModel): string => ownerAxis.fkMap[ownerModel]![0]!;

export const segmentOwnerId = (segment: OwnerColumns): string =>
  (segment as Record<string, unknown>)[segmentOwnerFk(segment.ownerModel)] as string;

export const customerRefProviderFk = (ownerModel: ProviderModel): string =>
  resolveFalsePolymorphismRef({ model: 'CustomerRef', axis: 'providerModel', value: ownerModel })!;

export const communicationSenderFk = (ownerModel: ProviderModel): string =>
  PolymorphismRegistry.CommunicationLog!.axes[0]!.fkMap[ownerModel]![0]!;

export const customerRefCustomerFk = (customerModel: string): string | null =>
  resolveFalsePolymorphismRef({
    model: 'CustomerRef',
    axis: 'customerModel',
    value: customerModel as ProviderModel,
  });
