/**
 * @atlas
 * @kind validator
 * @partOf feature:integrations, primitive:authz
 * @uses primitive:errors
 */
import { type HydratedRecord, hydrate } from '@template/db';
import type { IntegrationOwnerModel } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

type IntegrationOwner = {
  ownerModel: IntegrationOwnerModel;
  userId?: string;
  organizationId?: string;
  spaceId?: string;
};

export const validateReachableIntegration = async (
  c: Context<AppEnv>,
  owner: IntegrationOwner,
): Promise<void> => {
  const draft = await hydrate('integration', { id: '', ...owner } as HydratedRecord);
  if (!check(c.get('permix'), rebacSchema, 'integration', draft, 'read'))
    throw makeError({ status: 403, message: 'This credential does not reach new integrations' });
};
