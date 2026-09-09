/**
 * @atlas
 * @kind helper
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { PolymorphismRegistry, resolveFalsePolymorphismRef } from '@template/db';
import type { SegmentOwnerModel } from '@template/db/generated/client/enums';

type OwnerColumns = {
  ownerModel: SegmentOwnerModel;
  userId?: string | null;
  organizationId?: string | null;
  spaceId?: string | null;
};

const ownerAxis = PolymorphismRegistry.Segment!.axes[0]!;

export const segmentOwnerFk = (ownerModel: SegmentOwnerModel): string => ownerAxis.fkMap[ownerModel]![0]!;

export const segmentOwnerId = (segment: OwnerColumns): string =>
  (segment as Record<string, unknown>)[segmentOwnerFk(segment.ownerModel)] as string;

export const customerRefProviderFk = (ownerModel: SegmentOwnerModel): string | null =>
  resolveFalsePolymorphismRef({ model: 'CustomerRef', axis: 'providerModel', value: ownerModel });

export const communicationSenderFk = (ownerModel: SegmentOwnerModel): string =>
  PolymorphismRegistry.CommunicationLog!.axes[0]!.fkMap[ownerModel]![0]!;

export const customerRefCustomerFk = (customerModel: string): string | null =>
  resolveFalsePolymorphismRef({
    model: 'CustomerRef',
    axis: 'customerModel',
    value: customerModel as SegmentOwnerModel,
  });

export class SegmentOwnerError extends Error {
  constructor(ownerModel: SegmentOwnerModel) {
    super(
      `CustomerRef has no provider branch for ${ownerModel}; a ${ownerModel} cannot select customer references yet`,
    );
    this.name = 'SegmentOwnerError';
  }
}

export const requireCustomerRefProviderFk = (ownerModel: SegmentOwnerModel): string => {
  const fk = customerRefProviderFk(ownerModel);
  if (!fk) throw new SegmentOwnerError(ownerModel);
  return fk;
};
