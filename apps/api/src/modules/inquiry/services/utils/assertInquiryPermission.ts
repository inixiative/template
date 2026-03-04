import type { Db, HydratedRecord } from '@template/db';
import { hydrate } from '@template/db';
import type { InquiryAction, Permix } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';

export const assertInquiryPermission = async (
  db: Db,
  permix: Permix,
  inquiry: HydratedRecord,
  action: InquiryAction,
  requestId?: string,
): Promise<void> => {
  const hydrated = await hydrate(db, 'inquiry', inquiry);
  if (!check(permix, rebacSchema, 'inquiry', hydrated, action)) {
    throw makeError({ status: 403, message: 'Access denied', requestId });
  }
};
