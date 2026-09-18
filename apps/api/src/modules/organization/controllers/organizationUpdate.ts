/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { emitAppEvent } from '#/appEvents/emit';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationUpdateRoute } from '#/modules/organization/routes/organizationUpdate';

export const organizationUpdateController = makeController(organizationUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const org = getResource<'organization'>(c);
  const body = c.req.valid('json');

  const organization = await db.organization.update({
    where: { id: org.id },
    data: body,
  });

  await emitAppEvent('organization.updated', { organization });

  return respond.ok(organization);
});
