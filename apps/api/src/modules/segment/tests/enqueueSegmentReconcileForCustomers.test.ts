import { afterEach, beforeEach, describe, expect, it, type Mock, spyOn } from 'bun:test';
import * as enqueueModule from '#/jobs/enqueue';
import type { ReconcileCustomerRelationshipSegmentsPayload } from '#/jobs/handlers/reconcileCustomerRelationshipSegments';
import { enqueueSegmentReconcileForCustomers } from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

describe('enqueueSegmentReconcileForCustomers', () => {
  let enqueued: Mock<typeof enqueueModule.enqueueJob>;

  beforeEach(() => {
    enqueued = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({
      jobId: 'job',
      name: 'reconcileCustomerRelationshipSegments',
    });
  });

  afterEach(() => enqueued.mockRestore());

  it('sends every customer in jobs of at most 2,000, dropping duplicates and missing customers', async () => {
    const customers = Array.from({ length: 4500 }, (_, i) => ({
      customerModel: 'User' as const,
      customerId: `user-${i}`,
    }));

    await enqueueSegmentReconcileForCustomers([...customers, customers[0]!, null]);

    expect(
      enqueued.mock.calls.map(
        ([, payload]) => (payload as ReconcileCustomerRelationshipSegmentsPayload).customers.length,
      ),
    ).toEqual([2000, 2000, 500]);
  });

  it('enqueues nothing when no customer is given', async () => {
    await enqueueSegmentReconcileForCustomers([null]);
    expect(enqueued).not.toHaveBeenCalled();
  });
});
