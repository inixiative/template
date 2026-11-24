/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import { type AuthenticatorTransport, generateAuthenticationOptions } from '@simplewebauthn/server';
import { db } from '@template/db';
import { makeError } from '#/lib/errors';
import { resolveWebAuthnOrigin } from '#/lib/twoFactor/passkey/resolveWebAuthnOrigin';
import { storePendingWebAuthnChallenge } from '#/lib/twoFactor/pendingWebAuthnChallenge';

export const createPasskeyAuthenticationOptions = async ({
  userId,
  origin,
}: {
  userId: string;
  origin: string | undefined;
}) => {
  const { expectedOrigin, rpId } = resolveWebAuthnOrigin(origin);
  const passkeys = await db.passkey.findMany({
    where: { userId, rpId },
    select: { credentialId: true, transports: true },
  });
  if (!passkeys.length)
    throw makeError({ status: 400, message: 'No passkeys are registered for this domain' });

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: passkey.transports as AuthenticatorTransport[],
    })),
    userVerification: 'preferred',
  });

  await storePendingWebAuthnChallenge('authenticate', {
    challenge: options.challenge,
    rpId,
    expectedOrigin,
    userId,
  });

  return { options: options as unknown as Record<string, unknown>, rpId };
};
