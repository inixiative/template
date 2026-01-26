import { HTTPException } from 'hono/http-exception';
import { getUser } from '#/lib/context/getUser';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateRoute } from '../routes/organizationCreate';

export const organizationCreateController = makeController(organizationCreateRoute, async (c, respond) => {
  const db = c.get('db');
  const user = getUser(c)!;
  const body = c.req.valid('json');

  const existing = await db.organization.findUnique({ where: { slug: body.slug } });
  if (existing) throw new HTTPException(409, { message: 'Slug already exists' });

  const organization = await db.organization.create({
    data: {
      ...body,
      organizationUsers: {
        create: {
          userId: user!.id,
          role: 'owner',
        },
      },
    },
  });

  return respond.created(organization);
});
