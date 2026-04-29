import { makeController } from '#/lib/utils/makeController';
import { meCreateContactRoute } from '#/modules/me/routes/meCreateContact';

export const meCreateContactController = makeController(
  meCreateContactRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    const db = c.get('db');
    const body = c.req.valid('json');

    const contact = await db.contact.create({
      data: {
        ...body,
        value: body.value, // contactRules hook validates + normalizes per-type
        ownerModel: 'User',
        userId: user.id,
      } as never,
    });

    return respond.created(contact);
  },
);
