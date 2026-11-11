/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { emitAppEvent } from '#/appEvents/emit';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { reviveOrCreateContact } from '#/modules/contact/services/reviveOrCreateContact';
import { spaceCreateContactRoute } from '#/modules/space/routes/spaceCreateContact';

export const spaceCreateContactController = makeController(
  spaceCreateContactRoute,
  async (c, respond) => {
    const space = getResource<'space'>(c);
    const body = c.req.valid('json');

    const contact = await reviveOrCreateContact({ ownerModel: 'Space', spaceId: space.id }, body);

    await emitAppEvent('contact.created', { contact });

    return respond.created(contact);
  },
);
