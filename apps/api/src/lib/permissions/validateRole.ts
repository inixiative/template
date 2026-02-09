import { HTTPException } from 'hono/http-exception';
import { Role } from '@template/db/generated/client/enums';

/**
 * Validates a role value against the Role enum.
 * Throws HTTPException if the value is invalid.
 *
 * This prevents permission bypass from corrupted database values or type assertions
 * and makes invalid roles immediately visible during development.
 */
export const validateRole = (value: unknown): Role => {
  if (typeof value === 'string' && Object.values(Role).includes(value as Role)) {
    return value as Role;
  }
  throw new HTTPException(500, {
    message: `Invalid role value: ${JSON.stringify(value)}. Expected one of: ${Object.values(Role).join(', ')}`,
  });
};
