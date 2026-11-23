/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:billing
 * @uses feature:billing
 */
import { BillingAccountOwnerModel } from '@template/db/generated/client/enums';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { toBillingAccountResponse } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { createBillingAccountRecord } from '#/modules/billingAccount/services/createBillingAccount';
import { organizationUserCreateBillingAccountRoute } from '#/modules/organizationUser/routes/organizationUserCreateBillingAccount';

export const organizationUserCreateBillingAccountController = makeController(
  organizationUserCreateBillingAccountRoute,
  async (c, respond) => {
    const member = contextResource<'organizationUser'>(c);
    const account = await createBillingAccountRecord({
      owner: {
        ownerModel: BillingAccountOwnerModel.OrganizationUser,
        organizationId: member.organizationId,
        userId: member.userId,
      },
      ...c.req.valid('json'),
    });
    return respond.created(toBillingAccountResponse(account));
  },
);
