/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:contact
 */
import { emitAppEvent } from '#/appEvents/emit';
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { reviveOrCreateContact } from '#/modules/contact/services/reviveOrCreateContact';
import { meCreateContactRoute } from '#/modules/me/routes/meCreateContact';

export const meCreateContactController = makeController(
  meCreateContactRoute,
  async (c, respond) => {
    const user = actingUser(c)!;
    const body = c.req.valid('json');

    const contact = await reviveOrCreateContact({ ownerModel: 'User', userId: user.id }, body);

    await emitAppEvent('contact.created', { contact });

    return respond.created(contact);
  },
);
