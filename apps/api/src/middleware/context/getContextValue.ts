import type { AppEnv, AppVarKeys, AppVars } from '@src/types/appEnv';
import type { Context } from 'hono';

/**
 * Strongly-typed wrapper around `c.get`.
 * Returns the value with correct type based on the key.
 *
 * @example
 * const user = getContextValue(c, 'user'); // typed as { id: string; email: string } | null
 */
export function getContextValue<K extends AppVarKeys>(
  c: Context<AppEnv>,
  key: K,
): AppVars[K] {
  return c.get(key);
}
