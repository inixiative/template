import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { contactUpdateRoute } from '#/modules/contact/routes/contactUpdate';

export const contactUpdateController = makeController(contactUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const contact = getResource<'contact'>(c);
  const body = c.req.valid('json');

  const updated = await db.contact.update({
    where: { id: contact.id },
    data: body as never, // contactRules hook validates + normalizes per-type
  });

  return respond.ok(updated);
});
