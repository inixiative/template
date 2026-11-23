/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses infrastructure:billing
 */
import type {
  BillingAccountOwnerModel,
  BillingAccountStatus,
} from '@template/db/generated/client/enums';
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type BillingAccountStatusChangedPayload = {
  billingAccountId: string;
  ownerModel: BillingAccountOwnerModel;
  userId: string | null;
  organizationId: string | null;
  spaceId: string | null;
  previousStatus: BillingAccountStatus | null;
  status: BillingAccountStatus;
};

export const billingAccountStatusChanged = makeAppEvent<BillingAccountStatusChangedPayload>({});
