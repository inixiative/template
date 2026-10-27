/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses primitive:errors
 */
import { isHttpErrorCode } from '@template/shared/errors';
import { isAPIError } from 'better-auth/api';
import { setRequestCookie } from 'better-auth/cookies';
import { makeSignature } from 'better-auth/crypto';
import { auth } from '#/lib/auth';
import { makeError } from '#/lib/errors';

const THROWAWAY_SESSION_SECONDS = 60;

const asAppError = (error: unknown): unknown => {
  if (!isAPIError(error)) return error;
  // why: a 401 inside the call means our throwaway was revoked mid-flight (a concurrent revokeOtherSessions), not the caller's credential
  if (error.statusCode === 401)
    return makeError({ status: 409, message: 'Another account change is in progress; try again' });
  if (error.statusCode >= 500 || !isHttpErrorCode(error.statusCode)) return makeError({ status: 500 });
  return makeError({ status: error.statusCode, message: error.message });
};

export const withThrowawaySession = async <Result>(
  userId: string,
  call: (headers: Headers) => Promise<Result>,
): Promise<Result> => {
  const context = await auth.$context;
  const session = await context.internalAdapter.createSession(
    userId,
    false,
    { expiresAt: new Date(Date.now() + THROWAWAY_SESSION_SECONDS * 1000) },
    true,
  );
  try {
    const headers = new Headers();
    const signature = await makeSignature(session.token, context.secret);
    setRequestCookie(headers, context.authCookies.sessionToken.name, `${session.token}.${signature}`);
    return await call(headers);
  } catch (error) {
    throw asAppError(error);
  } finally {
    await context.internalAdapter.deleteSession(session.token);
  }
};
