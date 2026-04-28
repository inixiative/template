import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { contactDeleteRoute } from '#/modules/contact/routes/contactDelete';

export const contactDeleteController = makeController(contactDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const contact = getResource<'contact'>(c);
  await db.contact.delete({ where: { id: contact.id } });
  return respond.noContent();
});
