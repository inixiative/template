/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma
 */
import { db, Prisma } from '@template/db';
import type { TwoFactor } from '@template/db/generated/client/client';

export const ensureTwoFactorRow = async (userId: string): Promise<TwoFactor> => {
  const [locked] = await db.withDeleted(() =>
    db.findForUpdate<TwoFactor>('TwoFactor', { userId }, { upserting: true }),
  );
  if (locked && locked.deletedAt == null) return locked;
  if (locked) {
    return db.withDeleted(() =>
      db.twoFactor.update({
        where: { id: locked.id },
        data: {
          encryptedTotpSecret: null,
          encryptedTotpSecretMetadata: Prisma.DbNull,
          encryptedTotpSecretKeyVersion: null,
          totpVerifiedAt: null,
          backupCodeHashes: [],
          backupCodesGeneratedAt: null,
          deletedAt: null,
        },
      }),
    );
  }

  return db.twoFactor.create({ data: { userId, backupCodeHashes: [] } });
};
