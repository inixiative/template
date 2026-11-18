/**
 * @atlas
 * @kind controller
 * @partOf feature:contact
 * @uses primitive:routeTemplates
 */
import { emitAppEvent } from '#/appEvents/emit';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { contactDeleteRoute } from '#/modules/contact/routes/contactDelete';

export const contactDeleteController = makeController(contactDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const contact = contextResource<'contact'>(c);
  const deleted = await db.contact.update({
    where: { id: contact.id },
    data: { deletedAt: new Date() },
  });
  await emitAppEvent('contact.deleted', { contact: deleted });
  return respond.noContent();
});
