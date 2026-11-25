/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { type AuthenticatorTransport, generateRegistrationOptions } from '@simplewebauthn/server';
import { db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { resolveWebAuthnOrigin } from '#/lib/twoFactor/passkey/resolveWebAuthnOrigin';
import { storePendingWebAuthnChallenge } from '#/lib/twoFactor/pendingWebAuthnChallenge';

export const createPasskeyRegistrationOptions = async ({
  user,
  origin,
}: {
  user: Pick<User, 'id' | 'email' | 'name' | 'displayName'>;
  origin: string | undefined;
}) => {
  const { expectedOrigin, rpId, rpName } = resolveWebAuthnOrigin(origin);
  const existing = await db.passkey.findMany({
    where: { userId: user.id, rpId },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userID: new Uint8Array(Buffer.from(user.id, 'utf8')),
    userName: user.email,
    userDisplayName: user.displayName || user.name || user.email,
    attestationType: 'none',
    excludeCredentials: existing.map((passkey) => ({
      id: passkey.credentialId,
      transports: passkey.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });

  await storePendingWebAuthnChallenge('register', {
    challenge: options.challenge,
    rpId,
    expectedOrigin,
    userId: user.id,
  });

  return { options: options as unknown as Record<string, unknown>, rpId };
};
