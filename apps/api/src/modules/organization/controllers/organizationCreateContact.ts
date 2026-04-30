import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateContactRoute } from '#/modules/organization/routes/organizationCreateContact';

export const organizationCreateContactController = makeController(
  organizationCreateContactRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource<'organization'>(c);
    const body = c.req.valid('json');

    const contact = await db.contact.create({
      data: {
        ...body,
        ownerModel: 'Organization',
        organizationId: organization.id,
      } as Prisma.ContactUncheckedCreateInput,
    });

    return respond.created(contact);
  },
);
