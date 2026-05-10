import { db, type Prisma } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { ContactRegistry } from '@template/shared/contact';
import { makeError } from '#/lib/errors';

export type ResolveUserByContactArgs = {
  type: ContactType;
  valueKey: string;
  value: Prisma.InputJsonValue;
  displayName?: string | null;
};

/**
 * Look up the User who owns a given Contact (type + valueKey), creating a
 * stub User + Contact pair when no match exists. Used by listener-style
 * paths where an external observer (e.g. a chat-platform bot) sees a
 * message from someone with no app account yet.
 *
 * Stub-User email is derived via the type's `toStubEmail` registry method
 * (e.g. whatsappDef → `${digits}@whatsapp.${PROJECT_NAME}`). Types without
 * that method cannot be stub-created — the function throws.
 *
 * Check-and-create runs inside a single transaction so a sibling request's
 * insert is visible by the time we re-check (READ COMMITTED). True
 * concurrent first-observation by two requests can still race past the
 * check; in that rare case the second insert errors out and the caller
 * retries.
 */
export const resolveUserByContact = async (args: ResolveUserByContactArgs): Promise<string> => {
  return db.$transaction(async (tx) => {
    const existing = await tx.contact.findFirst({
      where: { ownerModel: ContactOwnerModel.User, type: args.type, valueKey: args.valueKey },
      select: { userId: true },
    });
    if (existing?.userId) return existing.userId;

    const def = ContactRegistry[args.type];
    if (!def?.toStubEmail) {
      throw makeError({
        status: 500,
        message: `Cannot stub-create User for contact type "${args.type}": registry has no toStubEmail`,
      });
    }
    const pseudoEmail = def.toStubEmail(args.value as never);

    const user = await tx.user.create({
      data: {
        email: pseudoEmail,
        name: args.displayName || null,
        displayName: args.displayName || null,
        emailVerified: false,
      },
    });
    await tx.contact.create({
      data: {
        ownerModel: ContactOwnerModel.User,
        userId: user.id,
        type: args.type,
        valueKey: args.valueKey,
        value: args.value,
      },
    });
    return user.id;
  });
};
