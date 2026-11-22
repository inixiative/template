/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:contact
 */
import { emitAppEvent } from '#/appEvents/emit';
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { addContact } from '#/modules/contact/services/addContact';
import { meCreateContactRoute } from '#/modules/me/routes/meCreateContact';

export const meCreateContactController = makeController(
  meCreateContactRoute,
  async (c, respond) => {
    const user = actingUser(c)!;
    const body = c.req.valid('json');

    const contact = await addContact({ ownerModel: 'User', userId: user.id }, body);

    await emitAppEvent('contact.created', { contact });

    return respond.created(contact);
  },
);
