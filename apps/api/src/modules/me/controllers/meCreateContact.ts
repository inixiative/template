/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:contact
 */
import type { Prisma } from '@template/db';
import { emitAppEvent } from '#/appEvents/emit';
import { me } from '#/lib/context/me';
import { makeController } from '#/lib/utils/makeController';
import { meCreateContactRoute } from '#/modules/me/routes/meCreateContact';

export const meCreateContactController = makeController(
  meCreateContactRoute,
  async (c, respond) => {
    const user = me(c)!;
    const db = c.get('db');
    const body = c.req.valid('json');

    const contact = await db.contact.create({
      data: {
        ...body,
        ownerModel: 'User',
        userId: user.id,
      } as Prisma.ContactUncheckedCreateInput,
    });

    await emitAppEvent('contact.created', { contact });

    return respond.created(contact);
  },
);
