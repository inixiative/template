import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { contactReadRoute } from '#/modules/contact/routes/contactRead';

export const contactReadController = makeController(contactReadRoute, async (c, respond) => {
  const contact = getResource<'contact'>(c);
  return respond.ok(contact);
});
