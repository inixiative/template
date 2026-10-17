/**
 * @atlas
 * @kind helper
 * @partOf feature:segment
 * @uses infrastructure:prisma, primitive:jobs
 */
import { type ModelName, polymorphicTarget } from '@template/db';
import type { CustomerModel } from '@template/db/generated/client/enums';
import { enqueueJob } from '#/jobs/enqueue';

type Polymorphic = { model: ModelName; axis: string };

/** Reconcile the customer a false-polymorphic row points at — the resource a tag is attached to, the owner of a contact. */
export const reconcileCustomerOf = async (
  { model, axis }: Polymorphic,
  row: Record<string, unknown>,
): Promise<void> => {
  const target = polymorphicTarget(row, model, axis);
  if (!target) return;
  await enqueueJob('reconcileCustomerRefSegments', {
    customerModel: target.kind as CustomerModel,
    customerId: target.id,
  });
};
