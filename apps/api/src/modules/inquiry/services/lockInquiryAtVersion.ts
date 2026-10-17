/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma, primitive:errors
 */
import type { Db } from '@template/db';
import { makeError } from '#/lib/errors';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

export const lockInquiryAtVersion = async (
  db: Db,
  inquiryId: string,
  expectedUpdatedAt?: Date,
): Promise<Inquiry> => {
  const [fresh] = await db.findForUpdate<Inquiry>('Inquiry', { id: inquiryId });
  if (!fresh) throw makeError({ status: 404, message: 'Inquiry not found' });
  if (expectedUpdatedAt && new Date(fresh.updatedAt).getTime() !== expectedUpdatedAt.getTime())
    throw makeError({
      status: 409,
      message: 'The inquiry changed since you read it; reload it and try again',
    });
  return fresh;
};
