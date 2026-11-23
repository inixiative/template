/**
 * @atlas
 * @kind controller
 * @partOf feature:billing
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { billingResourceDeleteRoute } from '#/modules/billingResource/routes/billingResourceDelete';

export const billingResourceDeleteController = makeController(
  billingResourceDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const resource = contextResource<'billingResource'>(c);
    await db.billingResource.update({
      where: { id: resource.id },
      data: { deletedAt: new Date() },
    });
    return respond.noContent();
  },
);
