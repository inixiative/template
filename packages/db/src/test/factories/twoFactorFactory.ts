/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { Prisma } from '@template/db/generated/client/client';
import { registerFactory } from '@template/db/test/factory';

const twoFactorFactory = registerFactory('TwoFactor', {
  defaults: () => ({
    encryptedTotpSecret: null,
    encryptedTotpSecretMetadata: Prisma.DbNull,
    encryptedTotpSecretKeyVersion: null,
    totpVerifiedAt: null,
    backupCodeHashes: [],
    backupCodesGeneratedAt: null,
  }),
  dependencies: {
    user: {
      modelName: 'User',
      foreignKey: { id: 'userId' },
      required: true,
    },
  },
});

export const buildTwoFactor = twoFactorFactory.build;
export const createTwoFactor = twoFactorFactory.create;
