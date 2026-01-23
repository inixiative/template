import type { AppEnv, AppVarKeys, AppVars } from '@src/types/appEnv';
import type { Context } from 'hono';

/**
 * Strongly-typed wrapper around `c.set`.
 * Constrains keys to known AppVars and ensures value matches the expected type.
 *
 * Use when keys may come from variables (to avoid widening to `string` and Hono overload errors).
 *
 * @example
 * setContextValue(c, 'user', { id: '123', email: 'test@example.com' });
 */
export function setContextValue<K extends AppVarKeys>(
  c: Context<AppEnv>,
  key: K,
  value: AppVars[K],
): void {
  c.set(key, value);
}
