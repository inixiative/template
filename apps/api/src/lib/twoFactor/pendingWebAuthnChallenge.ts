/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:redis, primitive:errors
 */
import { redisClient, redisNamespace } from '@template/db';
import { makeError } from '#/lib/errors';

const WEBAUTHN_CHALLENGE_TTL_SECONDS = 5 * 60;

export type PendingWebAuthnChallenge = {
  challenge: string;
  rpId: string;
  expectedOrigin: string;
  userId: string;
};

const challengeKey = (kind: 'register' | 'authenticate', userId: string) =>
  `${redisNamespace.otp}:webauthn:${kind}:${userId}`;

export const storePendingWebAuthnChallenge = async (
  kind: 'register' | 'authenticate',
  data: PendingWebAuthnChallenge,
): Promise<void> => {
  await redisClient().setex(
    challengeKey(kind, data.userId),
    WEBAUTHN_CHALLENGE_TTL_SECONDS,
    JSON.stringify(data),
  );
};

export const consumePendingWebAuthnChallengeOrThrow = async (
  kind: 'register' | 'authenticate',
  userId: string,
): Promise<PendingWebAuthnChallenge> => {
  const raw = await redisClient().getdel(challengeKey(kind, userId));
  if (!raw)
    throw makeError({ status: 400, message: 'Passkey challenge expired. Please try again.' });
  return JSON.parse(raw) as PendingWebAuthnChallenge;
};

export const clearPendingWebAuthnChallenges = async (userId: string): Promise<void> => {
  await redisClient().del(challengeKey('register', userId), challengeKey('authenticate', userId));
};
