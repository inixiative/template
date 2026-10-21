/**
 * @atlas
 * @kind config
 * @partOf feature:auth
 * @uses none
 */
import { jwt } from 'better-auth/plugins';
import { jwtHandoff } from '#/lib/auth/jwtHandoff';
import { oauthHandoffPlugins } from '#/lib/auth/oauthHandoffPlugins';
import { personJwtOptions } from '#/lib/auth/personJwt';

// Order is load-bearing: jwtHandoff runs last, after the one-time-token hook has read the new session.
export const authPlugins = () => {
  const [oneTimeToken, oauthCallbackToken] = oauthHandoffPlugins();
  return [jwt(personJwtOptions()), oneTimeToken, oauthCallbackToken, jwtHandoff()];
};
