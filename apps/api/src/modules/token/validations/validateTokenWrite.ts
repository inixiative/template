/**
 * @atlas
 * @kind validator
 * @partOf feature:auth
 * @uses primitive:authz
 */
import { type HydratedRecord, hydrate } from '@template/db';
import { type Permix, TokenAction } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { validateFullGrant } from '#/lib/permissions/validateFullGrant';

export const validateTokenWrite = async (
  writer: Permix,
  token: Record<string, unknown>,
): Promise<void> => {
  const row = await hydrate('token', token as HydratedRecord);
  if (!check(writer, rebacSchema, 'token', row, TokenAction.create))
    throw makeError({ status: 403, message: 'Access denied' });
  if (row.full) validateFullGrant(writer, 'token', row);
};
