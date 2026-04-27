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
        value: body.value, // contactRules hook validates + normalizes per-type
        ownerModel: 'Space',
        spaceId: space.id,
      } as never,
    });

    return respond.created(contact);
  },
);
