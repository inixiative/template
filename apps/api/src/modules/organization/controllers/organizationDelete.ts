import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationDeleteRoute } from '#/modules/organization/routes/organizationDelete';

export const organizationDeleteController = makeController(organizationDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const org = getResource<'organization'>(c);

  await db.organization.update({
    where: { id: org.id },
    data: { deletedAt: new Date() },
  });

  return respond.noContent();
});
