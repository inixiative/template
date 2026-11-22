/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:billing
 * @uses feature:billing
 */
import { BillingAccountOwnerModel } from '@template/db/generated/client/enums';
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { toBillingAccountResponse } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { createBillingAccountRecord } from '#/modules/billingAccount/services/createBillingAccount';
import { meCreateBillingAccountRoute } from '#/modules/me/routes/meCreateBillingAccount';

export const meCreateBillingAccountController = makeController(
  meCreateBillingAccountRoute,
  async (c, respond) => {
    const user = actingUser(c)!;
    const account = await createBillingAccountRecord({
      owner: { ownerModel: BillingAccountOwnerModel.User, userId: user.id },
      ...c.req.valid('json'),
    });
    return respond.created(toBillingAccountResponse(account));
  },
);
