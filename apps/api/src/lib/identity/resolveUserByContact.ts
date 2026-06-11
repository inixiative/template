/**
 * @atlas
 * @kind service
 * @partOf feature:contact, feature:users
 */
import { db, type Prisma } from '@template/db';
import { ContactOwnerModel, type ContactType } from '@template/db/generated/client/enums';
import { ContactRegistry } from '@template/shared/contact';
import { makeError } from '#/lib/errors';

export type ResolveUserByContactArgs = {
  type: ContactType;
  valueKey: string;
  value: Prisma.InputJsonValue;
  displayName?: string | null;
};

export const resolveUserByContact = async (args: ResolveUserByContactArgs): Promise<string> => {
  return db.txn(async () => {
    const existing = await db.contact.findFirst({
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

    const user = await db.user.create({
      data: {
        email: pseudoEmail,
        name: args.displayName || null,
        displayName: args.displayName || null,
        emailVerified: false,
      },
    });
    await db.contact.create({
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
