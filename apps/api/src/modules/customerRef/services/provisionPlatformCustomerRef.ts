/**
 * @atlas
 * @kind service
 * @partOf feature:customer
 * @uses infrastructure:prisma
 */
import { db, polymorphicKeyColumn } from '@template/db';
import type { CustomerRef } from '@template/db/generated/client/client';
import type { CustomerModel } from '@template/db/generated/client/enums';

export type PlatformCustomerRefOutcome = { customerRef: CustomerRef; outcome: 'created' | 'revived' | 'present' };

export const provisionPlatformCustomerRef = async (
  customerModel: CustomerModel,
  customerId: string,
): Promise<PlatformCustomerRefOutcome> => {
  const customerFk = polymorphicKeyColumn('CustomerRef', 'customerModel', customerModel)!;
  const existing = await db.customerRef.findFirst({
    where: { [customerFk]: customerId, providerModel: 'platform', deletedAt: undefined },
  });
  if (existing && !existing.deletedAt) return { customerRef: existing, outcome: 'present' };
  if (existing) {
    const customerRef = await db.customerRef.update({ where: { id: existing.id }, data: { deletedAt: null } });
    return { customerRef, outcome: 'revived' };
  }
  const customerRef = await db.customerRef.create({
    data: { customerModel, [customerFk]: customerId, providerModel: 'platform' },
  });
  return { customerRef, outcome: 'created' };
};
