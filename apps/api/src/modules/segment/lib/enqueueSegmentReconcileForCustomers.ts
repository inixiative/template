/**
 * @atlas
 * @kind utils
 * @partOf feature:segment
 * @uses primitive:jobs
 */
import { type ModelName, rowPolymorphicAxisPointsAt } from '@template/db';
import type { CustomerModel } from '@template/db/generated/client/enums';
import { chunk, uniqBy } from 'lodash-es';
import { enqueueJob } from '#/jobs/enqueue';
import type { CustomerSide } from '#/modules/customerRelationship/lib/customerRelationshipSides';

type Polymorphic = { model: ModelName; axis: string };

const CUSTOMERS_PER_JOB = 2000;

export const customerSideOfRow = (
  { model, axis }: Polymorphic,
  row: Record<string, unknown>,
): CustomerSide | null => {
  const target = rowPolymorphicAxisPointsAt(row, model, axis);
  return target ? { customerModel: target.kind as CustomerModel, customerId: target.id } : null;
};

export const enqueueSegmentReconcileForCustomers = async (
  customers: (CustomerSide | null)[],
): Promise<void> => {
  const present = uniqBy(
    customers.filter((customer): customer is CustomerSide => customer !== null),
    ({ customerModel, customerId }) => `${customerModel}:${customerId}`,
  );
  for (const customers of chunk(present, CUSTOMERS_PER_JOB))
    await enqueueJob('reconcileCustomerRelationshipSegments', { customers });
};
