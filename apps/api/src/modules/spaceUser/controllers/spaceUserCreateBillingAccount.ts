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
import { spaceUserCreateBillingAccountRoute } from '#/modules/spaceUser/routes/spaceUserCreateBillingAccount';

export const spaceUserCreateBillingAccountController = makeController(
  spaceUserCreateBillingAccountRoute,
  async (c, respond) => {
    const member = contextResource<'spaceUser'>(c);
    const account = await createBillingAccountRecord({
      owner: {
        ownerModel: BillingAccountOwnerModel.SpaceUser,
        organizationId: member.organizationId,
        spaceId: member.spaceId,
        userId: member.userId,
      },
      ...c.req.valid('json'),
    });
    return respond.created(toBillingAccountResponse(account));
  },
);
