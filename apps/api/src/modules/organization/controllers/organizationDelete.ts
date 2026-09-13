/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { emitAppEvent } from '#/appEvents/emit';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationDeleteRoute } from '#/modules/organization/routes/organizationDelete';

export const organizationDeleteController = makeController(organizationDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const org = getResource<'organization'>(c);

  const organization = await db.organization.update({
    where: { id: org.id },
    data: { deletedAt: new Date() },
  });
  await emitAppEvent('organization.deleted', { organization });

  return respond.noContent();
});
