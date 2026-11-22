/**
 * @atlas
 * @kind config
 * @partOf feature:auth
 * @uses none
 */
import { jwt } from 'better-auth/plugins';
import { jwtHandoffPlugin } from '#/lib/auth/jwtHandoffPlugin';
import { oauthHandoffPlugins } from '#/lib/auth/oauthHandoffPlugins';
import { userJwtOptions } from '#/lib/auth/userJwt';

// Order is load-bearing: jwtHandoffPlugin runs last, after the one-time-token hook has read the new session.
export const authPlugins = () => {
  const [oneTimeToken, oauthCallbackToken] = oauthHandoffPlugins();
  return [jwt(userJwtOptions()), oneTimeToken, oauthCallbackToken, jwtHandoffPlugin()];
};
