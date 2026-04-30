import type { Prisma } from '@template/db';
import { makeController } from '#/lib/utils/makeController';
import { meCreateContactRoute } from '#/modules/me/routes/meCreateContact';

export const meCreateContactController = makeController(meCreateContactRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const body = c.req.valid('json');

  const contact = await db.contact.create({
    data: {
      ...body,
      ownerModel: 'User',
      userId: user.id,
    } as Prisma.ContactUncheckedCreateInput,
  });

  return respond.created(contact);
});
