/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses none
 */
import { setToken } from '@template/ui/lib/auth/token';

type JwtHandoff = { token: string; expiresAt: string | Date };

const isJwtHandoff = (data: unknown): data is JwtHandoff =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as JwtHandoff).token === 'string' &&
  !Number.isNaN(new Date((data as JwtHandoff).expiresAt).getTime());

// Sign-in answers with the person's JWT; the API keeps no session behind it.
export const storeJwtHandoff = (data: unknown): void => {
  if (!isJwtHandoff(data)) throw new Error('No token returned from sign in');
  setToken(data.token, new Date(data.expiresAt));
};
