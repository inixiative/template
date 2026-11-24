/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const passkeyFactory = registerFactory('Passkey', {
  defaults: () => {
    const seq = nextFactorySequenceNumber();
    return {
      credentialId: Buffer.from(`passkey-cred-${seq}`).toString('base64url'),
      publicKey: Buffer.from(`passkey-pubkey-${seq}`).toString('base64url'),
      rpId: 'localhost',
      counter: 0,
      deviceType: 'multiDevice',
      backedUp: true,
      transports: ['internal'],
      name: `Test Passkey ${seq}`,
    };
  },
  dependencies: {
    user: {
      modelName: 'User',
      foreignKey: { id: 'userId' },
      required: true,
    },
  },
});

export const buildPasskey = passkeyFactory.build;
export const createPasskey = passkeyFactory.create;
