/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import type { AuthenticationResponseJSON, AuthenticatorTransport } from '@simplewebauthn/server';
import { db } from '@template/db';
import type { Passkey } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';
import { verifyPasskeyAuthenticationOrThrow } from '#/lib/twoFactor/passkey/verifyPasskeyResponseOrThrow';
import { consumePendingWebAuthnChallengeOrThrow } from '#/lib/twoFactor/pendingWebAuthnChallenge';

export const verifyUserPasskey = async ({
  userId,
  response,
}: {
  userId: string;
  response: AuthenticationResponseJSON;
}): Promise<void> => {
  const challenge = await consumePendingWebAuthnChallengeOrThrow('authenticate', userId);

  await db.txn(async () => {
    const [passkey] = await db.findForUpdate<Passkey>('Passkey', {
      userId,
      credentialId: response.id,
      rpId: challenge.rpId,
    });
    if (!passkey) {
      throw makeError({ status: 401, message: 'Passkey is not registered for this account' });
    }

    const { newCounter } = await verifyPasskeyAuthenticationOrThrow({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.expectedOrigin,
      expectedRPID: challenge.rpId,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransport[],
      },
      requireUserVerification: false,
    });

    await db.passkey.update({
      where: { id: passkey.id },
      data: { counter: newCounter, lastUsedAt: new Date() },
    });
  });
};
