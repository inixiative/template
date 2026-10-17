/**
 * @atlas
 * @kind controller
 * @partOf feature:contact
 * @uses primitive:routeTemplates
 */
import { emitAppEvent } from '#/appEvents/emit';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { contactDeleteRoute } from '#/modules/contact/routes/contactDelete';

export const contactDeleteController = makeController(contactDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const contact = getResource<'contact'>(c);
  const deleted = await db.contact.delete({ where: { id: contact.id } });
  await emitAppEvent('contact.deleted', { contact: deleted });
  return respond.noContent();
});
