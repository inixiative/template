/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses primitive:errors
 */
import {
  type VerifyAuthenticationResponseOpts,
  type VerifyRegistrationResponseOpts,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { makeError } from '#/lib/errors';

export const verifyPasskeyRegistration = async (opts: VerifyRegistrationResponseOpts) => {
  const verification = await verifyRegistrationResponse(opts).catch(() => {
    throw makeError({ status: 400, message: 'Passkey registration verification failed' });
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw makeError({ status: 400, message: 'Passkey registration could not be verified' });
  }
  return verification.registrationInfo;
};

export const verifyPasskeyAuthentication = async (opts: VerifyAuthenticationResponseOpts) => {
  const verification = await verifyAuthenticationResponse(opts).catch(() => {
    throw makeError({ status: 401, message: 'Passkey verification failed' });
  });
  if (!verification.verified) {
    throw makeError({ status: 401, message: 'Passkey verification failed' });
  }
  return verification.authenticationInfo;
};
