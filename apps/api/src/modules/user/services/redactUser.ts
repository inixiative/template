import type { Db } from '@template/db';

export const redactUser = async (db: Db, userId: string) => {
  const now = new Date();

  // Soft delete orgs where this user is the only member
  const singleMemberOrgs = await db.organization.findMany({
    where: {
      organizationUsers: {
        every: { userId },
      },
    },
    select: { id: true },
  });

  if (singleMemberOrgs.length) {
    await db.organization.updateManyAndReturn({
      where: { id: { in: singleMemberOrgs.map((o) => o.id) } },
      data: { deletedAt: now },
    });
  }

  // Delete tokens (user and orgUser tokens both have userId)
  await db.token.deleteMany({ where: { userId } });

  // Remove from organizations
  await db.organizationUser.deleteMany({ where: { userId } });

  // Delete user's webhook subscriptions
  await db.webhookSubscription.deleteMany({ where: { userId, ownerModel: 'User' } });

  // Delete auth sessions and accounts
  await db.session.deleteMany({ where: { userId } });
  await db.account.deleteMany({ where: { userId } });

  // Redact user record (soft delete with anonymized data)
  await db.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@deleted.null`,
      emailVerified: false,
      name: '[DELETED]',
      displayName: '[DELETED]',
      image: null,
      deletedAt: now,
    },
  });
};
