/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz, feature:auth, feature:integrations
 * @uses primitive:errors, infrastructure:prisma
 */
import { type HydratedRecord, hydrate } from '@template/db';
import type { Token } from '@template/db/generated/client/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export type TokenBinding = Pick<Token, 'ownerModel' | 'integrationId'> &
  Partial<Pick<Token, 'userId' | 'organizationId' | 'spaceId'>>;

export const validateTokenBinding = async (
  c: Context<AppEnv>,
  binding: TokenBinding,
): Promise<void> => {
  if (!binding.integrationId) return;
  const draft = await hydrate('token', {
    id: '',
    ownerModel: binding.ownerModel,
    userId: binding.userId ?? null,
    organizationId: binding.organizationId ?? null,
    spaceId: binding.spaceId ?? null,
    integrationId: binding.integrationId,
  } as HydratedRecord);
  if (!draft.integration) throw makeError({ status: 422, message: 'Integration not found' });
  if (!check(c.get('permix'), rebacSchema, 'token', draft, 'bind'))
    throw makeError({
      status: 403,
      message:
        "Cannot bind this token to that integration: act on it, and bind only to the token owner's integration or one above it",
    });
};
