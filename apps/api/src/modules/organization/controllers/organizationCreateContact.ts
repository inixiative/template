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
import { organizationCreateContactRoute } from '#/modules/organization/routes/organizationCreateContact';

export const organizationCreateContactController = makeController(
  organizationCreateContactRoute,
  async (c, respond) => {
    const organization = contextResource<'organization'>(c);
    const body = c.req.valid('json');

    const contact = await addContact(
      { ownerModel: 'Organization', organizationId: organization.id },
      body,
    );

    await emitAppEvent('contact.created', { contact });

    return respond.created(contact);
  },
);
