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
import { spaceCreateBillingAccountRoute } from '#/modules/space/routes/spaceCreateBillingAccount';

export const spaceCreateBillingAccountController = makeController(
  spaceCreateBillingAccountRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const account = await createBillingAccountRecord({
      owner: {
        ownerModel: BillingAccountOwnerModel.Space,
        organizationId: space.organizationId,
        spaceId: space.id,
      },
      ...c.req.valid('json'),
    });
    return respond.created(toBillingAccountResponse(account));
  },
);
