/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:tenancy
 */
import type { Prisma } from '@template/db';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyOrganizationsRoute } from '#/modules/me/routes/meReadManyOrganizations';

type OrgWithUsers = Prisma.OrganizationGetPayload<{
  include: { organizationUsers: true };
}>;

export const meReadManyOrganizationsController = makeController(meReadManyOrganizationsRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');

  const { data: orgs, pagination } = await paginate<typeof db.organization, OrgWithUsers>(c, db.organization, {
    // Live-row scope on the membership itself (caller where subtrees are outside
    // paginate's injected scope) — a soft-deleted organizationUser must not keep
    // the org visible.
    where: {
      organizationUsers: { some: { userId: user.id, deletedAt: null } },
    },
    include: { organizationUsers: { where: { userId: user.id } } },
  });

  const data = orgs.map(({ organizationUsers, ...org }) => ({
    ...org,
    organizationUser: organizationUsers[0],
  }));

  return respond.ok(data, { pagination });
});
