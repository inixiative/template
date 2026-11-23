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
import { organizationCreateBillingAccountRoute } from '#/modules/organization/routes/organizationCreateBillingAccount';

export const organizationCreateBillingAccountController = makeController(
  organizationCreateBillingAccountRoute,
  async (c, respond) => {
    const organization = contextResource<'organization'>(c);
    const account = await createBillingAccountRecord({
      owner: {
        ownerModel: BillingAccountOwnerModel.Organization,
        organizationId: organization.id,
      },
      ...c.req.valid('json'),
    });
    return respond.created(toBillingAccountResponse(account));
  },
);
