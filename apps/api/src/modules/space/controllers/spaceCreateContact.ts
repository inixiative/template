import type { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceCreateContactRoute } from '#/modules/space/routes/spaceCreateContact';

export const spaceCreateContactController = makeController(
  spaceCreateContactRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);
    const body = c.req.valid('json');

    const contact = await db.contact.create({
      data: {
        ...body,
        ownerModel: 'Space',
        spaceId: space.id,
      } as Prisma.ContactUncheckedCreateInput,
    });

    return respond.created(contact);
  },
);
