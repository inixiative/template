/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { emitAppEvent } from '#/appEvents/emit';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { addContact } from '#/modules/contact/services/addContact';
import { spaceCreateContactRoute } from '#/modules/space/routes/spaceCreateContact';

export const spaceCreateContactController = makeController(
  spaceCreateContactRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const body = c.req.valid('json');

    const contact = await addContact({ ownerModel: 'Space', spaceId: space.id }, body);

    await emitAppEvent('contact.created', { contact });

    return respond.created(contact);
  },
);
