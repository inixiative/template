/**
 * @atlas
 * @kind controller
 * @partOf feature:contact
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { contactReadRoute } from '#/modules/contact/routes/contactRead';

export const contactReadController = makeController(contactReadRoute, async (c, respond) => {
  const contact = contextResource<'contact'>(c);
  return respond.ok(contact);
});
