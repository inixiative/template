import type { Prisma } from '@template/db';
import type { ContactType } from '@template/db/generated/client/enums';
import { contactId as toContactId } from '@template/db/typedModelIds';
import { ContactRegistry } from '@template/shared/contact';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const redactUser = async (c: Context<AppEnv>, userId: string) => {
  const db = c.get('db');
  const now = new Date();

  // Single-member containers → soft-delete (no orphan org/space left over).
  const singleMemberOrgs = await db.organization.findMany({
    where: { organizationUsers: { every: { userId } } },
    select: { id: true },
  });
  if (singleMemberOrgs.length) {
    await db.organization.updateManyAndReturn({
      where: { id: { in: singleMemberOrgs.map((o) => o.id) } },
      data: { deletedAt: now },
    });
  }

  const singleMemberSpaces = await db.space.findMany({
    where: { spaceUsers: { every: { userId } } },
    select: { id: true },
  });
  if (singleMemberSpaces.length) {
    await db.space.updateManyAndReturn({
      where: { id: { in: singleMemberSpaces.map((s) => s.id) } },
      data: { deletedAt: now },
    });
  }

  // Ephemeral auth state — hard delete.
  await db.token.deleteMany({ where: { userId } });
  await db.session.deleteMany({ where: { userId } });
  await db.account.deleteMany({ where: { userId } });
  await db.webhookSubscription.deleteMany({ where: { userId, ownerModel: 'User' } });

  // Memberships, attachments — soft delete. (AuthProvider is org-scoped.)
  await db.organizationUser.updateManyAndReturn({
    where: { userId, deletedAt: null },
    data: { deletedAt: now },
  });
  await db.spaceUser.updateManyAndReturn({
    where: { userId, deletedAt: null },
    data: { deletedAt: now },
  });
  await db.tagAttachment.updateManyAndReturn({
    where: { userId, deletedAt: null },
    data: { deletedAt: now },
  });

  // Contacts: per-type redact via the registry, then soft-delete.
  const contacts = await db.contact.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, type: true, value: true },
  });
  for (const c of contacts) {
    const def = ContactRegistry[c.type as ContactType];
    const scrubbed = def.redact(toContactId(c.id), c.value as never);
    await db.contact.update({
      where: { id: c.id },
      data: { value: scrubbed as Prisma.InputJsonValue, deletedAt: now },
    });
  }

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
