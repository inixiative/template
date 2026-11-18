/**
 * @atlas
 * @kind utils
 * @partOf feature:segment
 * @uses primitive:jobs
 */
import { type ModelName, rowPolymorphicAxisPointsAt } from '@template/db';
import type { CustomerModel } from '@template/db/generated/client/enums';
import { uniqBy } from 'lodash-es';
import { enqueueJob } from '#/jobs/enqueue';
import type { CustomerReference } from '#/modules/customerRelationship/lib/customerReference';

type Polymorphic = { model: ModelName; axis: string };

export const customerReferenceOfRow = (
  { model, axis }: Polymorphic,
  row: Record<string, unknown>,
): CustomerReference | null => {
  const target = rowPolymorphicAxisPointsAt(row, model, axis);
  return target ? { customerModel: target.kind as CustomerModel, customerId: target.id } : null;
};

export const enqueueSegmentReconcileForCustomers = async (
  customers: (CustomerReference | null)[],
): Promise<void> => {
  const present = uniqBy(
    customers.filter((customer): customer is CustomerReference => customer !== null),
    ({ customerModel, customerId }) => `${customerModel}:${customerId}`,
  );
  if (!present.length) return;
  await enqueueJob('reconcileCustomerRelationshipSegments', { customers: present });
};
