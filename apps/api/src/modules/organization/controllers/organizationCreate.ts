/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { type HydratedRecord, hydrate } from '@template/db';
import { OrganizationAction } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { me } from '#/lib/context/me';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateRoute } from '#/modules/organization/routes/organizationCreate';

export const organizationCreateController = makeController(
  organizationCreateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const user = me(c)!;
    const body = c.req.valid('json');
    const standIn = await hydrate('organization', { id: '', ...body } as HydratedRecord);
    if (!check(c.get('permix'), rebacSchema, 'organization', standIn, OrganizationAction.create))
      throw makeError({ status: 403, message: 'Access denied' });

    const { organization, organizationUser } = await db.txn(async () => {
      const organization = await db.organization.create({ data: body });
      const organizationUser = await db.organizationUser.create({
        data: { organizationId: organization.id, userId: user.id, role: 'owner' },
      });
      return { organization, organizationUser };
    });

    return respond.created({
      ...organization,
      organizationUser,
    });
  },
);
