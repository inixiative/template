import { Role } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';

/**
 * Validates a role value against the Role enum.
 * Throws standardized API error if the value is invalid.
 *
 * This prevents permission bypass from corrupted database values or type assertions
 * and makes invalid roles immediately visible during development.
 */
export const validateRole = (value: unknown, requestId = 'unknown'): Role => {
  if (typeof value === 'string' && Object.values(Role).includes(value as Role)) {
    return value as Role;
  }
  throw makeError({
    status: 500,
    message: `Invalid role value: ${JSON.stringify(value)}. Expected one of: ${Object.values(Role).join(', ')}`,
    requestId,
  });
};
