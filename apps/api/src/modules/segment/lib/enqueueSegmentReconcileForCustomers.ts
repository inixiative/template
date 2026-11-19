/**
 * @atlas
 * @kind utils
 * @partOf feature:segment
 * @uses primitive:jobs
 */
import { chunk, uniqBy } from 'lodash-es';
import { enqueueJob } from '#/jobs/enqueue';
import type { CustomerSide } from '#/modules/customerRelationship/lib/customerRelationshipSides';

const CUSTOMERS_PER_JOB = 2000;

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
